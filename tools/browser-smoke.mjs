#!/usr/bin/env node
/** Fast browser coverage for the actual publication, without draft fixtures.
 * --root SITE --publication [--exports] [--browser chromium|firefox|webkit]
 * --decks slug,... limits deck checks; --artifacts DIR retains failure evidence.
 */
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDecks, launchChromium, startStaticServer, valueArg } from './lib/runtime.mjs';
import { browserDiagnostics } from './lib/browser-diagnostics.mjs';

const args = process.argv.slice(2);
const root = resolve(valueArg(args, '--root', resolve(dirname(fileURLToPath(import.meta.url)), '..')));
const engine = valueArg(args, '--browser', 'chromium');
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'unsupported browser');
const publication = args.includes('--publication');
const exportsRequired = args.includes('--exports');
const decks = listDecks(root, { includeDrafts: false, only: valueArg(args, '--decks', null)?.split(',') });
assert.ok(decks.length, 'no published decks selected');
const playwright = await import('playwright');
const site = await startStaticServer(root, { noStore: true });
const diagnostics = browserDiagnostics(valueArg(args, '--artifacts', null));
let browser, context;
try {
  browser = engine === 'chromium'
    ? await launchChromium(playwright.chromium, { executablePath: valueArg(args, '--executable-path', null) })
    : await playwright[engine].launch();
  context = await diagnostics.attach(await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }), `${engine}-publication`);
  await context.route('**/*', route => route.request().url().startsWith(site.base) ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(site.base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(site.base) && request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`failed ${request.url()}`);
  });
  await page.goto(`${site.base}/?q=zz-no-matching-talk-smoke-test`, { waitUntil: 'load' });
  assert.equal(await page.locator('li.talk:visible').count(), 0, 'search URL must restore its filter');
  await page.locator('#clear-filters').click();
  assert.ok(await page.locator('li.talk:visible').count() > 0, 'clear filters restores the archive');
  for (const slug of decks) {
    const url = `${site.base}/talks/${slug}/`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.DeckRuntime?.ready && window.Reveal?.isReady());
    await page.evaluate(() => window.DeckRuntime.ready);
    await page.evaluate(() => window.DeckRuntime.settle());
    if (publication) {
      assert.equal(await page.locator('aside.notes, [data-notes], script[src*="notes.js"]').count(), 0, `${slug}: notes survived publication`);
      assert.equal(await page.evaluate(() => typeof window.RevealNotes), 'undefined', `${slug}: speaker plugin exposed`);
    }
    const before = await page.evaluate(() => Reveal.getIndices().h);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(previous => Reveal.getIndices().h > previous, before);
    await page.locator('.toc-btn').click();
    await page.locator('.toc-overlay').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.locator('.toc-overlay').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.toc-btn').evaluate(element => element === document.activeElement), true, `${slug}: contents must restore focus`);
    await page.goto(`${url}read.html`, { waitUntil: 'load' });
    assert.ok(await page.locator('h1').count(), `${slug}: reader has a title`);
    assert.equal(await page.locator('aside.notes, [data-notes], iframe').count(), 0, `${slug}: reader exposes no notes or live frames`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${slug}: reader fits the phone viewport`);
    if (exportsRequired) {
      for (const [name, type] of [['slides.pdf', 'application/pdf'], ['social-card.png', 'image/png']]) {
        const response = await context.request.get(`${url}${name}`);
        assert.equal(response.status(), 200, `${slug}/${name} must exist`);
        assert.match(response.headers()['content-type'] || '', new RegExp(type));
      }
    }
    console.log(`ok    ${engine}: ${slug} — navigation, contents, read view${publication ? ', notes-free' : ''}${exportsRequired ? ', exports' : ''}`);
  }
  await page.goto(`${site.base}/404.html`);
  assert.ok(await page.locator('h1').count(), '404 has a heading');
  assert.deepEqual(errors, [], 'local resource or runtime errors');
} catch (error) {
  diagnostics.capture(engine, error.stack || String(error));
  process.exitCode = 1;
  console.error(error);
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  await site.close();
}
