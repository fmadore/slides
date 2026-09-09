import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://localhost:8742/talks/2026-06-15-luxembourg-beyond-keywords/?print-pdf', { waitUntil: 'load' });
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(2500);
const box = await page.evaluate(() => {
  const p = document.querySelector('.scroll-panel');
  p.scrollIntoView();
  const r = p.getBoundingClientRect();
  return { x: Math.max(0, r.x - 30), y: Math.max(0, r.y - 30), width: Math.min(1280, r.width + 60), height: Math.min(760, r.height + 90) };
});
await page.screenshot({ path: 'scratchpad/papercut.png', clip: box });
await b.close();
