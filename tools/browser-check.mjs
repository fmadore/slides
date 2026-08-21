#!/usr/bin/env node
/* Browser checks for every deck, at the three standard viewport sizes.
 *
 * For each deck (every talks/<dir>/index.html) plus the landing page:
 *   • 1280×720  — no JS/page errors, no failed local resources, no slide
 *                 auto-fitted below the readability threshold (data-fit-fail),
 *                 no raw overflow on unfitted slides
 *   • 844×390   — the persistent footer never covers slide content
 *   • 390×844   — reveal's scroll view stays off; the canvas fits horizontally;
 *                 no slide auto-fitted below the threshold under the narrow
 *                 (≤640px) chrome, whose tighter slide padding re-runs auto-fit
 *                 at a different scale than the desktop pass measures
 *
 * Then once, on the component catalogue: the motion switch — .no-draw must
 * zero --draw-run and reach every animated mark and every counting numeral.
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

// True when a console message is about our own origin rather than a third party.
function isLocal(text) { return text.includes('127.0.0.1') || text.includes('localhost'); }

async function openPage(ctx, url) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    // Count JS errors and *local* resource failures; ignore flaky external
    // fetches (live iframes, remote embeds) so CI stays hermetic.
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR/.test(t) && !isLocal(t)) return;
    // A remote site refusing to be framed (X-Frame-Options / frame-ancestors)
    // is the exact condition .site-frame's placeholder fallback exists for, and
    // it depends on the *remote* server's headers — so it says nothing about
    // this deck. Whether it fires at all depends on whether the runner has
    // network, which made the gate flaky in both directions.
    if (/(Content Security Policy directive: "frame-ancestors|in a frame because it set 'X-Frame-Options')/.test(t) && !isLocal(t)) return;
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
    // Auto-fit only measures once webfonts settle; wait so the walk below sees
    // real data-fit stamps instead of racing them.
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const r = await page.evaluate(() => {
      const scroll = !!document.querySelector('.reveal.reveal-scroll');
      const rect = document.querySelector('.slides').getBoundingClientRect();
      // The ≤640px chrome tightens --slide-pad-x, so auto-fit lands at a
      // different scale here than the 1280×720 pass measures — walk the deck
      // so a narrow-only data-fit-fail surfaces in CI, not in someone's hand.
      const fitFails = [];
      const hs = Reveal.getHorizontalSlides();
      for (let h = 0; h < hs.length; h++) {
        Reveal.slide(h, 0);
        for (const s of [hs[h], ...hs[h].querySelectorAll(':scope > section')]) {
          if (s.hasAttribute('data-fit-fail')) fitFails.push(`#${h + 1} scale ${s.getAttribute('data-fit-fail')}`);
        }
      }
      return { scroll, left: rect.left, right: rect.right, vw: innerWidth, fitFails };
    }).catch(() => null);
    if (!r) fail(where, '390×844 — could not inspect');
    else {
      if (r.scroll) fail(where, '390×844 — reveal switched to scroll view');
      if (r.left < -1 || r.right > r.vw + 1) fail(where, `390×844 — canvas clipped horizontally (${Math.round(r.left)}..${Math.round(r.right)} in ${r.vw})`);
      for (const f of r.fitFails) fail(where, `390×844 — slide auto-fitted below threshold: ${f} (trim it or add data-fit-allow)`);
      if (!r.scroll && r.left >= -1 && r.right <= r.vw + 1 && !r.fitFails.length) ok(where, '390×844 — fixed canvas, no clipping, no fit failures');
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

// ---- the one stiller: .no-draw has to reach every animated mark -----------
// The opt-out no deck applies is the opt-out nothing exercises. `--draw-run` is
// the single property print, `?print-pdf`, prefers-reduced-motion and .no-draw
// all throw, and the promise is that throwing it stills the whole signature.
// This measures the catalogue twice — switch off, then on — so a mark that
// stopped reading the switch shows up, and so does a theme that quietly lost
// its motion: a run that counts zero animated marks proves nothing and fails.
{
  const stillDeck = existsSync(join(ROOT, 'talks', '_showcase', 'index.html')) ? '_showcase' : '_template';
  const where = `talks/${stillDeck}`;
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'no-preference',   // the switch under test must be the only one thrown
  });
  const { page } = await openPage(ctx, `${BASE}/talks/${stillDeck}/`);
  await page.waitForFunction(isDeckReady, null, { timeout: 15000 }).catch(() => {});
  const report = await page.evaluate(() => {
    const ms = value => {
      const n = parseFloat(value);
      return isNaN(n) ? 0 : (/ms$/.test(String(value).trim()) ? n : n * 1000);
    };
    const label = (el, pseudo) => {
      const cls = el.getAttribute && el.getAttribute('class');
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls.trim().split(/\s+/).join('.') : ''}${pseudo || ''}`;
    };
    // Every animated mark on a slide, including the ::before/::after the
    // signature actually draws its rules and plates with.
    const marksOn = slide => {
      const out = [];
      for (const el of [slide, ...slide.querySelectorAll('*')]) {
        for (const pseudo of [null, '::before', '::after']) {
          const cs = getComputedStyle(el, pseudo);
          if (!cs.animationName || cs.animationName === 'none') continue;
          out.push({
            what: label(el, pseudo),
            name: cs.animationName,
            longest: Math.max(...cs.animationDuration.split(',').map(ms)),
          });
        }
      }
      return out;
    };
    const walk = () => {
      const slides = [];
      const hs = Reveal.getHorizontalSlides();
      for (let h = 0; h < hs.length; h++) {
        Reveal.slide(h, 0);
        while (Reveal.nextFragment()) { /* fragment-revealed marks count too */ }
        const slide = Reveal.getCurrentSlide();
        slides.push({
          h: h + 1,
          drawRun: getComputedStyle(slide).getPropertyValue('--draw-run').trim(),
          marks: marksOn(slide),
          // deck.js reads the same property before starting a count, so the JS
          // half is measured here too: nothing may still be rolling.
          rolling: [...slide.querySelectorAll('[data-count]')]
            .filter(el => el._countRAF)
            .map(el => label(el, null)),
          counts: slide.querySelectorAll('[data-count]').length,
        });
      }
      return slides;
    };
    const moving = walk();
    document.querySelector('.reveal').classList.add('no-draw');
    const still = walk();
    return { moving, still };
  }).catch(error => ({ error: String(error) }));

  if (report.error) {
    fail(where, `could not measure the motion switch: ${report.error}`);
  } else {
    const count = slides => slides.reduce((n, s) => n + s.marks.length, 0);
    const running = slides => slides.flatMap(s => s.marks
      .filter(m => m.longest > 0).map(m => `#${s.h} ${m.what} (${m.name})`));
    const marks = count(report.moving);
    const drew = running(report.moving).length;
    const stillRunning = running(report.still);
    const notZeroed = report.still.filter(s => s.drawRun !== '0s').map(s => `#${s.h} (${s.drawRun})`);
    const rolling = report.still.flatMap(s => s.rolling.map(w => `#${s.h} ${w}`));
    const counters = report.moving.reduce((n, s) => n + s.counts, 0);

    if (!marks || !drew) {
      fail(where, `motion switch: found ${marks} animated mark(s), ${drew} of them running — ` +
                  'nothing to still, so this check would pass on a theme with no signature left');
    }
    if (!counters) fail(where, 'motion switch: no [data-count] numerals in the catalogue to still');
    for (const m of notZeroed) fail(where, `motion switch: .no-draw left --draw-run at ${m}`);
    for (const m of stillRunning) fail(where, `motion switch: .no-draw did not reach ${m}`);
    for (const m of rolling) fail(where, `motion switch: a count is still rolling under .no-draw — ${m}`);
    if (marks && drew && counters && !notZeroed.length && !stillRunning.length && !rolling.length) {
      ok(where, `motion switch — .no-draw stills all ${drew} animated mark(s) and ${counters} count(s)`);
    }
  }
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
