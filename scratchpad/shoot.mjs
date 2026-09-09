/* Screenshot every slide of every deck from a given root. */
import { startStaticServer, listDecks, launchChromium } from '../tools/lib/runtime.mjs';
import { resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const ROOT = resolve(process.argv[2]);
const OUT = resolve(process.argv[3]);
const { chromium } = await import('playwright');
const site = await startStaticServer(ROOT);
const browser = await launchChromium(chromium, {});
for (const slug of [...listDecks(ROOT, { includeDrafts: false }), null]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const dir = join(OUT, slug || '_landing');
  mkdirSync(dir, { recursive: true });
  await page.goto(site.base + (slug ? `/talks/${slug}/?print-pdf` : '/'), { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts ? document.fonts.ready : null);
  if (slug) await page.waitForSelector('.reveal .pdf-page', { timeout: 30000 });
  await page.waitForTimeout(2000);
  if (!slug) { await page.screenshot({ path: join(dir, 'landing.png') }); await ctx.close(); continue; }
  const n = await page.evaluate(() => document.querySelectorAll('.reveal .pdf-page').length);
  for (let i = 0; i < n; i++) {
    const el = await page.$(`.reveal .pdf-page:nth-of-type(${i + 1})`);
    if (el) await el.screenshot({ path: join(dir, String(i + 1).padStart(2, '0') + '.png') });
  }
  console.log(slug, n);
  await ctx.close();
}
await browser.close(); await site.close();
