#!/usr/bin/env node
/* Browser checks for every deck, at the three standard viewport sizes.
 *
 * For each deck (every talks/<dir>/index.html) plus the landing page:
 *   • 1280×720  — no JS/page errors, no failed local resources, no slide
 *                 auto-fitted below the readability threshold (data-fit-fail),
 *                 no raw overflow on unfitted slides
 *   • 844×390   — the persistent footer never covers slide content
 *   • 390×844   — reveal's scroll view stays off; the canvas fits horizontally
 *
 * Usage:
 *   node tools/browser-check.mjs [--root DIR] [--screenshots DIR] [--decks a,b]
 *
 * --root defaults to the repository root (checks the source tree); pass a
 * build directory (e.g. _site) to check the publication build instead.
 * --screenshots captures representative template slides at all three sizes
 * (used by the visual-regression job). Requires playwright (npm i playwright
 * or a global install) and a chromium (npx playwright install chromium).
 *
 * Exit status: 1 if any check failed, else 0.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  intArg,
  launchChromium,
  listDecks,
  mapLimit,
  startStaticServer,
  valueArg,
} from './lib/runtime.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ROOT = resolve(valueArg(args, '--root', REPO));
const SHOT_DIR = valueArg(args, '--screenshots', null);
const ONLY = valueArg(args, '--decks', null)?.split(',');
const CONCURRENCY = intArg(args, '--concurrency', 2);
const EXECUTABLE_PATH = valueArg(args, '--executable-path', null);
const BROWSER_CHANNEL = valueArg(args, '--browser-channel', null);

const { chromium } = await import('playwright');

const staticSite = await startStaticServer(ROOT, { noStore: true });
const BASE = staticSite.base;

// Every deck in talks/ (published and underscore-prefixed alike).
const decks = listDecks(ROOT, { includeDrafts: true, only: ONLY });

const failures = [];
function fail(where, msg) { failures.push({ where, msg }); console.log(`FAIL  ${where}: ${msg}`); }
function ok(where, msg) { console.log(`ok    ${where}: ${msg}`); }

const browser = await launchChromium(chromium, {
  executablePath: EXECUTABLE_PATH,
  channel: BROWSER_CHANNEL,
});

async function openPage(ctx, url) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    // Count JS errors and *local* resource failures; ignore flaky external
    // fetches (live iframes, remote embeds) so CI stays hermetic.
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR/.test(t) && !t.includes('127.0.0.1')) return;
    errors.push(t);
  });
  page.on('requestfailed', r => {
    if (r.url().startsWith(BASE) && r.failure()?.errorText !== 'net::ERR_ABORTED') {
      errors.push(`request failed: ${r.url()}`);
    }
  });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.fonts ? document.fonts.ready : null);
  await page.waitForTimeout(600);
  return { page, errors };
}

const isDeckReady = () => typeof window.Reveal !== 'undefined' && Reveal.isReady && Reveal.isReady();

async function checkDeck(deck) {
  const url = `${BASE}/talks/${deck}/`;
  const where = `talks/${deck}`;

  // ---- 1280×720: errors, fit failures, raw overflow --------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const { page, errors } = await openPage(ctx, url);
    await page.waitForFunction(isDeckReady, null, { timeout: 15000 }).catch(() => {});
    const report = await page.evaluate(() => {
      const out = { fits: [], fitFails: [], overflows: [] };
      const hs = Reveal.getHorizontalSlides();
      for (let h = 0; h < hs.length; h++) {
        Reveal.slide(h, 0);
        // walk fragments so fragment-revealed content is laid out too
        while (Reveal.nextFragment()) { /* step through */ }
        const all = [hs[h], ...hs[h].querySelectorAll(':scope > section')];
        for (const s of all) {
          const label = `#${h + 1}`;
          if (s.hasAttribute('data-fit')) out.fits.push(`${label}×${s.getAttribute('data-fit')}`);
          if (s.hasAttribute('data-fit-fail')) out.fitFails.push(`${label} scale ${s.getAttribute('data-fit-fail')}`);
          if (!s.querySelector(':scope > .fit') &&
              (s.scrollHeight > s.clientHeight + 2 || s.scrollWidth > s.clientWidth + 2)) {
            out.overflows.push(`${label} (${s.scrollWidth}×${s.scrollHeight} in ${s.clientWidth}×${s.clientHeight})`);
          }
        }
      }
      return out;
    }).catch(e => ({ error: String(e) }));
    if (report.error) fail(where, `could not inspect slides: ${report.error}`);
    else {
      for (const f of report.fitFails) fail(where, `slide auto-fitted below threshold: ${f} (trim it or add data-fit-allow)`);
      for (const o of report.overflows) fail(where, `slide overflows the 1280×720 canvas: ${o}`);
      ok(where, `1280×720 — ${report.fits.length ? 'auto-fitted: ' + report.fits.join(', ') : 'no slide needed fitting'}`);
    }
    for (const e of errors) fail(where, `console: ${e}`);
    await ctx.close();
  }

  // ---- 844×390: footer must never cover slide content -------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const { page } = await openPage(ctx, url);
    await page.waitForFunction(isDeckReady, null, { timeout: 15000 }).catch(() => {});
    const bad = await page.evaluate(() => {
      const footer = document.querySelector('.deck-footer').getBoundingClientRect();
      const out = [];
      const hs = Reveal.getHorizontalSlides();
      for (let h = 0; h < hs.length; h++) {
        Reveal.slide(h, 0);
        const r = Reveal.getCurrentSlide().getBoundingClientRect();
        if (r.bottom > footer.top + 1) out.push(`#${h + 1} (+${Math.round(r.bottom - footer.top)}px)`);
      }
      return out;
    }).catch(() => ['inspect error']);
    if (bad.length) fail(where, `844×390 — footer overlaps slides: ${bad.join(', ')}`);
    else ok(where, '844×390 — footer clear of all slides');
    await ctx.close();
  }

  // ---- 390×844: fixed canvas, no scroll view, no horizontal clipping ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const { page } = await openPage(ctx, url);
    await page.waitForFunction(isDeckReady, null, { timeout: 15000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const scroll = !!document.querySelector('.reveal.reveal-scroll');
      const rect = document.querySelector('.slides').getBoundingClientRect();
      return { scroll, left: rect.left, right: rect.right, vw: innerWidth };
    }).catch(() => null);
    if (!r) fail(where, '390×844 — could not inspect');
    else {
      if (r.scroll) fail(where, '390×844 — reveal switched to scroll view');
      if (r.left < -1 || r.right > r.vw + 1) fail(where, `390×844 — canvas clipped horizontally (${Math.round(r.left)}..${Math.round(r.right)} in ${r.vw})`);
      if (!r.scroll && r.left >= -1 && r.right <= r.vw + 1) ok(where, '390×844 — fixed canvas, no clipping');
    }
    await ctx.close();
  }
}

await mapLimit(decks, CONCURRENCY, checkDeck);

// ---- landing page ---------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const { page, errors } = await openPage(ctx, `${BASE}/`);
  const talks = await page.evaluate(() => document.querySelectorAll('li.talk').length);
  if (talks < 1) fail('index.html', 'landing page lists no talks');
  else ok('index.html', `landing page lists ${talks} talks`);
  for (const e of errors) fail('index.html', `console: ${e}`);
  await ctx.close();
}

// ---- representative screenshots (visual regression source) ----------------
// Capture the component catalogue: talks/_showcase where it exists, falling
// back to talks/_template for older trees (before the starter/catalogue split).
if (SHOT_DIR) {
  mkdirSync(SHOT_DIR, { recursive: true });
  const shotDeck = existsSync(join(ROOT, 'talks', '_showcase', 'index.html')) ? '_showcase' : '_template';
  const fallbackShots = [
    { name: 'cover', index: 0 },
    { name: 'index', index: 1 },
    { name: 'divider', index: 2 },
    { name: 'content', index: 3 },
    { name: 'data-viz', index: 19 },
    { name: 'closing', index: 23 },
  ];
  for (const [w, h] of [[1280, 720], [844, 390], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const { page } = await openPage(ctx, `${BASE}/talks/${shotDeck}/`);
    await page.waitForFunction(isDeckReady, null, { timeout: 15000 }).catch(() => {});
    const markedShots = await page.evaluate(() => Reveal.getHorizontalSlides()
      .map((slide, index) => ({ name: slide.dataset.visualTest, index }))
      .filter(shot => shot.name));
    const shots = markedShots.length ? markedShots : fallbackShots;
    for (const shot of shots) {
      const current = await page.evaluate(i => {
        Reveal.slide(i, 0);
        return Reveal.getIndices().h;
      }, shot.index);
      if (current !== shot.index) {
        fail('screenshots', `${shotDeck}: could not select visual-test slide ${shot.name} (#${shot.index + 1})`);
        continue;
      }
      await page.waitForTimeout(1800); // let transitions, rule-draw and count-ups settle
      await page.screenshot({ path: join(SHOT_DIR, `catalogue-${shot.name}-${w}x${h}.png`) });
    }
    await ctx.close();
    console.log(`ok    screenshots: ${shotDeck} @ ${w}×${h} → ${SHOT_DIR}`);
  }
}

await browser.close();
await staticSite.close();
console.log(failures.length
  ? `\nbrowser-check: ${failures.length} failure(s)`
  : '\nbrowser-check: all checks passed');
process.exit(failures.length ? 1 : 0);
