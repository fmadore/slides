#!/usr/bin/env node
/** Hermetic browser fixtures for export failures; no third-party requests. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { launchChromium } from './lib/runtime.mjs';
import { captureLiveFrames, installPrintFrameSnapshots } from './lib/pdf-frames.mjs';
import { printGeometry } from './lib/slides.mjs';
import { exportDeck } from './lib/export-deck.mjs';
import { reusableEvidence } from './lib/export-cache.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = mkdtempSync(join(tmpdir(), 'slides-export-browser-'));
const deckDir = join(root, 'talks', 'demo');
mkdirSync(deckDir, { recursive: true });
mkdirSync(join(root, 'shared'));
writeFileSync(join(root, 'shared', 'theme.css'), 'fixture');
writeFileSync(join(deckDir, 'index.html'), 'fixture');
const fixture = `<!doctype html><style>
  @page { size:1280px 720px; margin:0 } body { margin:0 }
  .pdf-page { width:1280px; height:720px; position:relative; break-after:page }
  section { padding:20px } h1 { margin:0 }
  .pdf-imprint { position:absolute; bottom:10px; left:20px }
  </style><div class="reveal"><div class="slides"><section id="one"><h1>Export fixture</h1><p>One complete slide.</p></section></div></div>
  <script>
  const slide=document.querySelector('section');
  if(location.search.includes('print-pdf')){
    const wrapper=document.createElement('div');wrapper.className='pdf-page';slide.before(wrapper);wrapper.append(slide);
    const imprint=document.createElement('div');imprint.className='pdf-imprint';imprint.textContent='1 / 1';wrapper.append(imprint);
  }
  window.Reveal={getIndices:()=>({h:0,v:0})};
  window.DeckRuntime={ready:Promise.resolve(),leafSlides:()=>[slide],settle:()=>Promise.resolve()};
  </script>`;
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://fixture.test').pathname;
  if (path === '/frame/redirect') { response.writeHead(302, { location: '/frame/ok' }); response.end(); return; }
  if (path === '/frame/offline') { request.socket.destroy(); return; }
  if (path === '/frame/slow') { response.writeHead(200, { 'content-type': 'text/html' }); response.flushHeaders(); return; }
  if (path.startsWith('/frame/')) {
    const status = path === '/frame/404' ? 404 : path === '/frame/503' ? 503 : 200;
    response.writeHead(status, { 'content-type': 'text/html',
      ...(path === '/frame/denied' || path === '/frame/503' ? { 'x-frame-options': 'DENY' } : {}) });
    response.end(path === '/frame/blank' ? '<html><body></body></html>' : `<h1>${status} fixture</h1><p>Rendered content with an actual HTTP status.</p>`);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end(path === '/talks/demo/' ? fixture : '<!doctype html><title>Frame test</title>');
});
let browser, failures = 0;
const quiet = { log() {}, warn() {} };

async function check(name, action) {
  try { await action(); console.log(`ok    ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL  ${name}: ${error.stack}`); }
}

try {
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await launchChromium(chromium);
  console.log(`info  export regression: Chromium ${browser.version()}`);

  async function withPage(action) {
    const context = await browser.newContext();
    try { const page = await context.newPage(); await page.goto(base); await action(page); }
    finally { await context.close(); }
  }
  async function frame(page, endpoint) {
    await page.setContent(`<div class="reveal"><div class="slides"><section><iframe title="fixture" style="width:640px;height:360px" src="${base}/frame/${endpoint}"></iframe></section></div></div>`);
    return (await captureLiveFrames(page, { timeoutMs: 500, settleMs: 5 }))[0];
  }

  await check('HTTP 404 and blocked HTTP 503 captures remain retryable failures', () => withPage(async page => {
    for (const status of [404, 503]) {
      const capture = await frame(page, String(status));
      assert.equal(capture.dataUrl, null);
      assert.equal(capture.status, status);
      assert.equal(capture.finalUrl, `${base}/frame/${status}`);
      assert.equal(capture.captureMode, 'top-level');
      const createdAt = new Date().toISOString();
      assert.equal(reusableEvidence({ version: 1, createdAt, frames: [{ captured: false, status }] }, Date.now() + 3600001), false);
    }
  }));
  await check('successful embedded, redirected, and denied-frame recovery preserve evidence', () => withPage(async page => {
    for (const endpoint of ['ok', 'redirect', 'denied']) {
      const capture = await frame(page, endpoint);
      assert.ok(capture.dataUrl);
      assert.equal(capture.status, 200);
      assert.equal(capture.finalUrl, `${base}/frame/${endpoint === 'redirect' ? 'ok' : endpoint}`);
      assert.equal(capture.captureMode, endpoint === 'denied' ? 'top-level' : 'embedded');
    }
  }));
  await check('offline and visually blank documents do not become successful snapshots', () => withPage(async page => {
    for (const endpoint of ['offline', 'blank']) {
      const capture = await frame(page, endpoint);
      assert.equal(capture.dataUrl, null);
      assert.match(capture.error, endpoint === 'blank' ? /blank/ : /failed|ERR_/);
    }
  }));
  await check('stalled frame navigation is bounded and recorded as a failure', () => withPage(async page => {
    await page.setContent(`<div class="reveal"><div class="slides"><section><iframe title="slow" src="${base}/frame/slow"></iframe></section></div></div>`, { waitUntil: 'domcontentloaded' });
    const [capture] = await captureLiveFrames(page, { timeoutMs: 100, settleMs: 0 });
    assert.equal(capture.dataUrl, null);
    assert.match(capture.error, /Timeout|timed out/);
  }));
  await check('relative and repeated frame URLs keep distinct capture-to-print mappings', () => withPage(async page => {
    await page.setContent('<div class="reveal"><div class="slides"><section><iframe title="first" src="/frame/ok"></iframe><iframe title="second" src="/frame/ok"></iframe></section></div></div>');
    const captures = await captureLiveFrames(page, { timeoutMs: 500, settleMs: 5 });
    assert.equal(captures.length, 2);
    assert.notEqual(captures[0].key, captures[1].key);
    assert.ok(captures.every(capture => capture.dataUrl && capture.url === `${base}/frame/ok`));
    assert.deepEqual(await installPrintFrameSnapshots(page, captures), { screenshots: 2, authoredFallbacks: 0, placeholders: 0 });
  }));
  await check('failed capture uses the authored screenshot and hides the original overlay', () => withPage(async page => {
    const png = new PNG({ width: 20, height: 20 }); png.data.fill(255);
    const source = `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;
    await page.setContent(`<div class="reveal"><div class="slides"><section><div><iframe src="/frame/404" title="live"></iframe><img class="amrc-fallback" data-src="${source}" alt="Saved research map" hidden></div></section></div></div>`);
    const installed = await installPrintFrameSnapshots(page, []);
    assert.deepEqual(installed, { screenshots: 0, authoredFallbacks: 1, placeholders: 0 });
    assert.equal(await page.locator('[data-pdf-frame-state="authored-fallback"]').getAttribute('alt'), 'Saved research map');
    assert.equal(await page.locator('.amrc-fallback').evaluate(element => element.hidden), true);
  }));
  await check('broken images in clipped regions fail print validation while deliberate crops pass', () => withPage(async page => {
    await page.setContent(`<style>.pdf-page{width:1280px;height:720px;position:relative}.pdf-imprint{position:absolute;bottom:0}section>div{overflow:hidden;width:600px;height:300px}</style><div class="pdf-page"><section><div><img src="data:image/png,invalid" alt="broken image"></div></section><div class="pdf-imprint">1</div></div>`);
    assert.match((await printGeometry(page)).join('\n'), /image failed: broken image/);
    await page.locator('section>div').evaluate(element => {
      element.innerHTML = '<p style="width:1500px">Deliberately clipped text in a document excerpt</p>';
    });
    assert.deepEqual(await printGeometry(page), []);
  }));
  await check('export writes a valid artifact set and reuses its cache', async () => {
    const options = { browser, root, repo, base, slug: 'demo', log: quiet };
    const first = await exportDeck(options);
    assert.equal(first.cached, false);
    assert.equal(first.evidence.pages, 1);
    assert.match(readFileSync(join(deckDir, 'slides.pdf'), 'latin1'), /^%PDF/);
    assert.equal((await exportDeck(options)).cached, true);
    assert.equal(browser.contexts().length, 0);
  });
  await check('social-card failure preserves previous PDF/card/evidence/hash and closes context', async () => {
    const before = new Map(readdirSync(deckDir).map(name => [name, readFileSync(join(deckDir, name))]));
    const failingBrowser = { version: () => browser.version(), async newContext(options) {
      const context = await browser.newContext(options);
      const original = context.newPage.bind(context);
      context.newPage = async () => { const page = await original(); page.screenshot = async () => { throw new Error('simulated screenshot failure'); }; return page; };
      return context;
    } };
    await assert.rejects(exportDeck({ browser: failingBrowser, root, repo, base, slug: 'demo', force: true, log: quiet }), /screenshot failure/);
    for (const [name, bytes] of before) assert.deepEqual(readFileSync(join(deckDir, name)), bytes);
    assert.equal(browser.contexts().length, 0);
    assert.equal(readdirSync(deckDir).some(name => name.startsWith('.export-stage-')), false);
  });
} finally {
  try { await browser?.close(); }
  finally { await new Promise(resolveClose => { server.closeAllConnections(); server.close(resolveClose); }); rmSync(root, { recursive: true, force: true }); }
}
console.log(`export browser regression: ${failures ? `${failures} failure(s)` : 'passed'}`);
process.exitCode = failures ? 1 : 0;
