#!/usr/bin/env node
/** Contact sheets: every slide of a deck, at a glance, for review.
 * --out DIR [--decks slug,...] [--full] [--live] [--viewport WxH] [--columns N]
 * Each slide is rendered in its final fragment state with reduced motion, then
 * tiled N×N per sheet (<slug>-sheetK.jpg), each cell labelled with its 1-based
 * slide number, the engine's annexe folio (A01…) and its auto-fit scale when
 * the engine had to shrink it. <slug>-info.json records the same per slide;
 * --full also keeps every slide as <slug>-NN.jpg. Without --decks every public
 * deck is captured; drafts (_template, _showcase…) only when named. Requests
 * leaving the local static server are blocked unless --live is given.
 */
import { mkdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserDiagnostics } from './lib/browser-diagnostics.mjs';
import { settleAnimations } from './lib/a11y.mjs';
import { intArg, launchChromium, listDecks, startStaticServer, valueArg } from './lib/runtime.mjs';

export const USAGE = `usage: node tools/contact-sheet.mjs --out DIR [options]
  --out DIR            where sheets, info.json and (with --full) slide images go
  --decks slug,...     decks to capture (default: every public deck; drafts
                       such as _template only when named)
  --full               also write one <slug>-NN.jpg per slide
  --live               allow external network (live iframes); blocked by default
  --viewport WxH       slide viewport, e.g. 1280x720 (default) or 390x844
  --columns N          cells per sheet row; a sheet holds N×N slides (default 3)
  --executable-path P  Chromium binary to use instead of Playwright's`;

const FLAGS = new Set(['--full', '--live', '--help', '-h']);
const VALUED = new Set(['--out', '--decks', '--viewport', '--columns', '--executable-path']);

/** Parse the CLI into a plain options object; throws with a readable message. */
export function parseArgs(args) {
  for (let i = 0; i < args.length; i++) {
    if (FLAGS.has(args[i])) continue;
    if (VALUED.has(args[i])) { i++; continue; }
    throw new Error(`unknown argument: ${args[i]}`);
  }
  if (args.includes('--help') || args.includes('-h')) return { help: true };
  const out = valueArg(args, '--out', null);
  if (!out) throw new Error('--out DIR is required');
  const rawDecks = valueArg(args, '--decks', null);
  const decks = rawDecks === null ? null : rawDecks.split(',').map(s => s.trim());
  if (decks && decks.some(d => !d)) throw new Error('--decks has an empty slug');
  const viewportRaw = valueArg(args, '--viewport', '1280x720');
  const m = /^([1-9][0-9]{1,4})x([1-9][0-9]{1,4})$/.exec(viewportRaw);
  if (!m) throw new Error(`--viewport must be WIDTHxHEIGHT, e.g. 1280x720 (got ${viewportRaw})`);
  const columns = intArg(args, '--columns', 3);
  if (columns > 10) throw new Error('--columns must be 10 or fewer');
  return {
    help: false,
    out: resolve(out),
    decks,
    full: args.includes('--full'),
    live: args.includes('--live'),
    viewport: { width: Number(m[1]), height: Number(m[2]) },
    columns,
    executablePath: valueArg(args, '--executable-path', null),
  };
}

/** Split `count` slides into sheets of `perSheet`: [{ sheet, start, end }] with
 *  1-based sheet numbers and a half-open 0-based [start, end) slide range. */
export function paginate(count, perSheet) {
  if (!Number.isSafeInteger(perSheet) || perSheet < 1) throw new Error('perSheet must be a positive integer');
  const pages = [];
  for (let start = 0; start < count; start += perSheet) {
    pages.push({ sheet: pages.length + 1, start, end: Math.min(count, start + perSheet) });
  }
  return pages;
}

/** Cell size on a sheet: landscape slides at 640 px wide, portrait at 300. */
export function cellSize({ width, height }) {
  const w = width >= height ? 640 : 300;
  return { width: w, height: Math.round(w * height / width) };
}

/** The label printed on a cell: slide number, annexe folio, fit scale. */
export function cellLabel({ n, folio, fit }) {
  return [String(n), folio && folio.startsWith('A') ? folio : null, fit ? `×${fit}` : null]
    .filter(Boolean).join(' · ');
}

const escapeHTML = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function sheetHTML(cells, columns, cell) {
  const gap = 8, pad = 4;
  const body = cells.map(c =>
    `<div><img src="data:image/jpeg;base64,${c.image}" alt=""><b${c.fail ? ' class="fail"' : ''}>${escapeHTML(c.label)}</b></div>`).join('');
  return `<!doctype html><style>
    body{margin:0;background:#888;display:grid;grid-template-columns:repeat(${columns},${cell.width}px);gap:${gap}px;padding:${pad}px;width:max-content}
    div{position:relative;width:${cell.width}px;height:${cell.height}px}
    img{width:100%;height:100%;display:block}
    b{position:absolute;left:0;top:0;background:#000;color:#fff;font:700 14px/1.3 sans-serif;padding:2px 6px}
    b.fail{background:#b00020}
  </style>${body}`;
}

async function captureDeck(browser, diagnostics, site, slug, opts) {
  const context = await diagnostics.attach(
    await browser.newContext({ viewport: opts.viewport, reducedMotion: 'reduce' }), `sheet-${slug}`);
  try {
    if (!opts.live) await context.route('**/*', route => route.request().url().startsWith(site.base) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`${site.base}/talks/${slug}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.DeckRuntime?.ready && window.Reveal?.isReady());
    await page.evaluate(() => window.DeckRuntime.ready);
    // Folios mirror the engine's (02-chrome.js): counted horizontal slides run
    // 01…N, data-visibility="uncounted" ones take an A-series; a vertical
    // stack's leaves share their horizontal slide's folio.
    const slides = await page.evaluate(() => {
      const pad2 = n => String(n).padStart(2, '0');
      const folios = new Map();
      let counted = 0, annexe = 0;
      for (const sec of Reveal.getHorizontalSlides()) {
        folios.set(sec, sec.getAttribute('data-visibility') === 'uncounted' ? `A${pad2(++annexe)}` : pad2(++counted));
      }
      return window.DeckRuntime.leafSlides().map((s, i) => {
        const top = s.parentElement?.closest('section') || s;
        return {
          n: i + 1,
          ...Reveal.getIndices(s),
          classes: s.className.replace(/\b(present|past|future|stack)\b/g, '').replace(/\s+/g, ' ').trim(),
          toc: s.getAttribute('data-toc') || top.getAttribute('data-toc') || null,
          folio: folios.get(top) || null,
        };
      });
    });
    const cells = [];
    const info = [];
    for (const slide of slides) {
      const fit = await page.evaluate(async ({ h, v }) => {
        Reveal.slide(h, v || 0);
        await window.DeckRuntime.settle();
        while (Reveal.nextFragment()) { /* final authored state */ }
        const s = Reveal.getCurrentSlide();
        return { fit: s.getAttribute('data-fit'), fitFail: s.hasAttribute('data-fit-fail') };
      }, slide);
      await settleAnimations(page);
      if (opts.live) await page.waitForTimeout(1200);
      const image = await page.screenshot({ type: 'jpeg', quality: 80 });
      if (opts.full) writeFileSync(join(opts.out, `${slug}-${String(slide.n).padStart(2, '0')}.jpg`), image);
      const record = { index: slide.n, h: slide.h, v: slide.v ?? 0, folio: slide.folio, classes: slide.classes, toc: slide.toc,
        fit: fit.fit ? Number(fit.fit) : null, fitFail: fit.fitFail };
      info.push(record);
      cells.push({ image: image.toString('base64'), label: cellLabel({ n: slide.n, folio: slide.folio, fit: fit.fit }), fail: fit.fitFail });
    }
    writeFileSync(join(opts.out, `${slug}-info.json`), `${JSON.stringify(info, null, 1)}\n`);
    const cell = cellSize(opts.viewport);
    const sheetPage = await context.newPage();
    const pages = paginate(cells.length, opts.columns * opts.columns);
    for (const { sheet, start, end } of pages) {
      const rows = Math.ceil((end - start) / opts.columns);
      const cols = Math.min(opts.columns, end - start);
      await sheetPage.setViewportSize({ width: cols * cell.width + (cols - 1) * 8 + 8, height: rows * cell.height + (rows - 1) * 8 + 8 });
      await sheetPage.setContent(sheetHTML(cells.slice(start, end), opts.columns, cell), { waitUntil: 'load' });
      await sheetPage.screenshot({ path: join(opts.out, `${slug}-sheet${sheet}.jpg`), type: 'jpeg', quality: 82 });
    }
    const fitted = info.filter(r => r.fit !== null).length;
    const failed = info.filter(r => r.fitFail).length;
    console.log(`${slug}: ${info.length} slides, ${pages.length} sheet(s), ${fitted} auto-fitted${failed ? `, ${failed} below threshold` : ''}`);
  } catch (error) {
    // Screenshot and keep the trace while the failing context is still open.
    diagnostics.capture(`contact sheet ${slug}`, error.stack || String(error));
    throw error;
  } finally {
    await context.close();
  }
}

export async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(`contact-sheet: ${error.message}\n${USAGE}`);
    return 1;
  }
  if (opts.help) { console.log(USAGE); return 0; }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let decks;
  try {
    decks = opts.decks ? listDecks(root, { only: opts.decks }) : listDecks(root, { includeDrafts: false });
  } catch (error) {
    console.error(`contact-sheet: ${error.message} (decks live in talks/<slug>/index.html)`);
    return 1;
  }
  if (!decks.length) { console.error('contact-sheet: no decks to capture'); return 1; }
  mkdirSync(opts.out, { recursive: true });
  const diagnostics = browserDiagnostics(join(opts.out, 'diagnostics'));
  const site = await startStaticServer(root, { noStore: true });
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await launchChromium(chromium, { executablePath: opts.executablePath });
    for (const slug of decks) await captureDeck(browser, diagnostics, site, slug, opts);
    console.log(`contact sheets: ${decks.length} deck(s) → ${opts.out}`);
    return 0;
  } catch (error) {
    console.error(error);
    return 1;
  } finally {
    if (browser) await browser.close();
    await site.close();
    // Diagnostics are kept only on failure; drop the directory when it is empty.
    try { rmdirSync(join(opts.out, 'diagnostics')); } catch { /* absent or holds failure evidence */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
