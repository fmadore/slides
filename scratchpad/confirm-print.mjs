import { chromium } from 'playwright';
const b = await chromium.launch();
const out = {};

// print media on the luxembourg stat slide
{
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://localhost:8742/talks/2026-06-15-luxembourg-beyond-keywords/?print-pdf', { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(2000);
  out.luxembourgPrint = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('section')].find(s => s.querySelector('[data-count]'));
    return {
      drawRun: getComputedStyle(sec).getPropertyValue('--draw-run').trim(),
      stats: [...sec.querySelectorAll('[data-count]')].map(e => e.textContent),
      titleBar: sec.querySelector('.slide-title') ? getComputedStyle(sec.querySelector('.slide-title'), '::before').transform : 'n/a',
      pages: document.querySelectorAll('.pdf-page').length,
      imprints: document.querySelectorAll('.pdf-imprint').length,
    };
  });
}
// the template's fragments must all be on the page in the print view
{
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://localhost:8742/talks/_template/?print-pdf', { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(2000);
  out.templatePrint = await page.evaluate(() => {
    const lis = [...document.querySelectorAll('li.fragment')];
    return {
      pages: document.querySelectorAll('.pdf-page').length,
      fragments: lis.length,
      visible: lis.map(e => { const c = getComputedStyle(e); return c.opacity + '/' + c.visibility; }),
    };
  });
}
console.log(JSON.stringify(out, null, 2));
await b.close();
