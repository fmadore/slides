import { startStaticServer, launchChromium } from '../tools/lib/runtime.mjs';
const REPO = 'C:/Users/frede/GitHub/slides';
const { chromium } = await import('playwright');
const site = await startStaticServer(REPO, { noStore: true });
const browser = await launchChromium(chromium, {});
for (const [w, h] of [[1280, 800], [500, 900], [1600, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${site.base}/talks/_showcase/?view=scroll`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const g = await page.evaluate(() => {
    const b = sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { sel, x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), cssW: cs.width, cssH: cs.height, transform: cs.transform, pos: cs.position, left: cs.left, top: cs.top, ov: cs.overflow }; };
    const vp = document.querySelector('.reveal-viewport');
    return {
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      vars: { slideScale: getComputedStyle(vp).getPropertyValue('--slide-scale'), pageHeight: getComputedStyle(vp).getPropertyValue('--page-height'), vw: getComputedStyle(vp).getPropertyValue('--viewport-width'), vh: getComputedStyle(vp).getPropertyValue('--viewport-height'), padding: getComputedStyle(vp).getPropertyValue('--page-scroll-padding') },
      boxes: ['.reveal', '.slides', '.scroll-page', '.scroll-page-sticky', '.scroll-page-content', '.slides section', '.slides section .cover-title, .slides section h1'].map(b),
      slidesInline: document.querySelector('.slides').getAttribute('style'),
      sectionInline: document.querySelector('.slides section').getAttribute('style'),
    };
  });
  console.log(`\n=== ${w}x${h} ===`);
  console.log(JSON.stringify(g, null, 1));
  await ctx.close();
}
await browser.close(); await site.close?.(); process.exit(0);
