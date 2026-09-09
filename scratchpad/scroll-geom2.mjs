import { startStaticServer, launchChromium } from '../tools/lib/runtime.mjs';
const REPO = 'C:/Users/frede/GitHub/slides';
const { chromium } = await import('playwright');
const site = await startStaticServer(REPO, { noStore: true });
const browser = await launchChromium(chromium, {});
for (const view of ['', '?view=scroll']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${site.base}/talks/_showcase/${view}`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const g = await page.evaluate(() => {
    const s = document.querySelector('.slides section');
    const cs = getComputedStyle(s);
    const r = s.getBoundingClientRect();
    return {
      boxSizing: cs.boxSizing, padding: cs.padding, width: cs.width, height: cs.height,
      rect: { x: +r.x.toFixed(1), w: +r.width.toFixed(1), y: +r.y.toFixed(1), h: +r.height.toFixed(1) },
      transform: cs.transform, position: cs.position, left: cs.left, top: cs.top,
      slidesCS: (() => { const e = document.querySelector('.slides'); const c = getComputedStyle(e); const rr = e.getBoundingClientRect(); return { pos: c.position, w: c.width, h: c.height, tf: c.transform, left: c.left, top: c.top, rect: [+rr.x.toFixed(1), +rr.y.toFixed(1), +rr.width.toFixed(1), +rr.height.toFixed(1)] }; })(),
      slidesInline: document.querySelector('.slides').getAttribute('style'),
    };
  });
  console.log(`\n=== view="${view}" ===`);
  console.log(JSON.stringify(g, null, 1));
  await ctx.close();
}
await browser.close(); await site.close?.(); process.exit(0);
