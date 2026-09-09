/* Per-image: classes, zoomability, largest rendered box on screen AND in print. */
import { startStaticServer, listDecks, launchChromium } from '../tools/lib/runtime.mjs';
import { resolve } from 'node:path';

const ROOT = resolve('_site');
const { chromium } = await import('playwright');
const site = await startStaticServer(ROOT);
const browser = await launchChromium(chromium, {});
const decks = listDecks(ROOT, { includeDrafts: false });
const acc = new Map();

const probe = () => {
  const out = [];
  for (const img of document.querySelectorAll('img')) {
    const r = img.getBoundingClientRect();
    out.push({
      src: img.currentSrc || img.src,
      nw: img.naturalWidth, nh: img.naturalHeight,
      rw: Math.round(r.width), rh: Math.round(r.height),
      cls: img.className || '',
      zoom: img.matches('.shot, .site-frame-view > img'),
      par: img.parentElement ? img.parentElement.className : '',
    });
  }
  return out;
};

for (const slug of decks) {
  for (const mode of ['screen', 'print']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const url = `${site.base}/talks/${slug}/` + (mode === 'print' ? '?print-pdf' : '');
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => document.fonts ? document.fonts.ready : null);
    if (mode === 'print') await page.waitForSelector('.reveal .pdf-page', { timeout: 30000 });
    await page.waitForTimeout(1500);
    if (mode === 'screen') {
      // walk every slide so lazily-laid-out images get a real box
      const n = await page.evaluate(() => window.Reveal ? Reveal.getTotalSlides() : 1);
      for (let i = 0; i < n; i++) {
        await page.evaluate(() => Reveal.next());
        await page.waitForTimeout(120);
        for (const d of await page.evaluate(probe)) record(slug, mode, d);
      }
    }
    for (const d of await page.evaluate(probe)) record(slug, mode, d);
    await ctx.close();
  }
}

function record(slug, mode, d) {
  const file = decodeURIComponent(d.src.replace(/^https?:\/\/[^/]+/, ''));
  const k = file;
  let e = acc.get(k);
  if (!e) { e = { file, nw: d.nw, nh: d.nh, screen: [0, 0], print: [0, 0], zoom: false, cls: new Set(), decks: new Set() }; acc.set(k, e); }
  e.nw = e.nw || d.nw; e.nh = e.nh || d.nh;
  e.zoom = e.zoom || d.zoom;
  if (d.cls) e.cls.add(d.cls);
  e.decks.add(slug);
  const cur = e[mode];
  if (d.rw * d.rh > cur[0] * cur[1]) e[mode] = [d.rw, d.rh];
}

await browser.close();
await site.close();

const rows = [...acc.values()].sort((a, b) => a.file.localeCompare(b.file));
console.log('file\tnatural\tscreen\tprint\tmaxRender\tover\tzoom\tclasses');
for (const e of rows) {
  const mw = Math.max(e.screen[0], e.print[0]), mh = Math.max(e.screen[1], e.print[1]);
  const over = mw ? (e.nw / mw).toFixed(1) : 'n/a';
  console.log(`${e.file}\t${e.nw}x${e.nh}\t${e.screen.join('x')}\t${e.print.join('x')}\t${mw}x${mh}\t${over}\t${e.zoom ? 'ZOOM' : ''}\t${[...e.cls].join('|')}`);
}
