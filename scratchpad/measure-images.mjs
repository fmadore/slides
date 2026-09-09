/* Measure every <img>'s natural vs rendered size in each deck's print view. */
import { startStaticServer, listDecks, launchChromium } from '../tools/lib/runtime.mjs';
import { resolve } from 'node:path';

const ROOT = resolve('_site');
const { chromium } = await import('playwright');
const site = await startStaticServer(ROOT);
const browser = await launchChromium(chromium, {});
const decks = listDecks(ROOT, { includeDrafts: false });
const rows = [];

for (const slug of decks) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`${site.base}/talks/${slug}/?print-pdf`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts ? document.fonts.ready : null);
  await page.waitForSelector('.reveal .pdf-page', { timeout: 30000 });
  await page.waitForTimeout(1800);
  const data = await page.evaluate(() => {
    const out = [];
    for (const img of document.querySelectorAll('img')) {
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      out.push({
        src: img.currentSrc || img.src,
        nw: img.naturalWidth, nh: img.naturalHeight,
        rw: Math.round(r.width), rh: Math.round(r.height),
        hidden: r.width === 0 || cs.display === 'none' || cs.visibility === 'hidden',
      });
    }
    // background images too
    for (const el of document.querySelectorAll('*')) {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && bg.includes('url(')) {
        const r = el.getBoundingClientRect();
        for (const m of bg.matchAll(/url\("?([^")]+)"?\)/g)) {
          if (m[1].startsWith('data:')) continue;
          out.push({ src: m[1], nw: 0, nh: 0, rw: Math.round(r.width), rh: Math.round(r.height), bg: true });
        }
      }
    }
    return out;
  });
  for (const d of data) rows.push({ slug, ...d });
  await ctx.close();
}
await browser.close();
await site.close();

// collapse per src, keep the largest rendered box
const byKey = new Map();
for (const r of rows) {
  const file = decodeURIComponent(r.src.replace(/^https?:\/\/[^/]+/, ''));
  const k = r.slug + '|' + file;
  const prev = byKey.get(k);
  if (!prev || r.rw * r.rh > prev.rw * prev.rh) byKey.set(k, { ...r, file });
  if (prev) prev.count = (prev.count || 1) + 1;
}
const list = [...byKey.values()].sort((a, b) => (a.slug + a.file).localeCompare(b.slug + b.file));
console.log('slug\tfile\tnatural\trendered\toversample_linear\tbg');
for (const r of list) {
  const over = r.rw ? (r.nw / r.rw).toFixed(1) : 'n/a';
  console.log(`${r.slug}\t${r.file}\t${r.nw}x${r.nh}\t${r.rw}x${r.rh}\t${over}\t${r.bg ? 'bg' : ''}`);
}
