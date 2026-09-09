import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const out = {};

// --- the raised type actually landed, and the rows still fit their grid ---
{
  const page = await ctx.newPage();
  await page.goto('http://localhost:8742/talks/2026-06-15-luxembourg-beyond-keywords/', { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  out.luxTags = await page.evaluate(() => {
    const tags = [...document.querySelectorAll('.kvm-tag')];
    const rows = [...document.querySelectorAll('.kvm-row')];
    const overflowing = rows.filter(r => r.scrollWidth > r.clientWidth + 1).length;
    const sec = document.querySelector('.kvm')?.closest('section');
    return {
      tagPx: tags.length ? +parseFloat(getComputedStyle(tags[0]).fontSize).toFixed(1) : null,
      tagCount: tags.length,
      rowsOverflowingHorizontally: overflowing,
      anyTagClipped: tags.filter(t => t.scrollWidth > t.clientWidth + 1).length,
      slideFit: sec ? sec.getAttribute('data-fit') : null,
      slideOverflowsVertically: sec ? sec.scrollHeight > sec.clientHeight + 3 : null,
    };
  });
  // the button no longer sweeps the outline
  out.luxBtn = await page.evaluate(() => {
    const el = document.querySelector('.kvm-btn');
    const cs = getComputedStyle(el);
    return { transitionProperty: cs.transitionProperty, transitionDuration: cs.transitionDuration };
  });
  await page.close();
}
{
  const page = await ctx.newPage();
  await page.goto('http://localhost:8742/talks/2026-05-06-dga-dormant-collections/', { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  out.dga = await page.evaluate(() => {
    const cap = document.querySelector('.bio-gallery figcaption');
    const ex = document.querySelector('.extract');
    const capSec = cap ? cap.closest('section') : null;
    return {
      captionPx: cap ? +parseFloat(getComputedStyle(cap).fontSize).toFixed(1) : null,
      captionWraps: cap ? cap.getBoundingClientRect().height : null,
      bioSlideFit: capSec ? capSec.getAttribute('data-fit') : null,
      extractBorder: ex ? getComputedStyle(ex).borderTopWidth + ' ' + getComputedStyle(ex).borderTopStyle : null,
      extractBg: ex ? getComputedStyle(ex).backgroundColor : null,
    };
  });
  await page.close();
}

// --- the paper cut: hidden on screen, drawn on paper, hint suppressed ---
for (const [key, url, media] of [
  ['screen', 'http://localhost:8742/talks/2026-06-15-luxembourg-beyond-keywords/', 'screen'],
  ['printPreview', 'http://localhost:8742/talks/2026-06-15-luxembourg-beyond-keywords/?print-pdf', 'screen'],
  ['printMedia', 'http://localhost:8742/talks/2026-06-15-luxembourg-beyond-keywords/?print-pdf', 'print'],
]) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  if (media === 'print') await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(2000);
  out[key] = await page.evaluate(() => {
    const p = document.querySelector('.scroll-panel');
    if (!p) return { missing: true };
    const before = getComputedStyle(p, '::before'), after = getComputedStyle(p, '::after');
    const hint = document.querySelector('.scroll-hint');
    return {
      mark: getComputedStyle(p).getPropertyValue('--excerpt-mark').trim() || '(unset)',
      beforeDisplay: before.display, beforeContent: before.content,
      afterDisplay: after.display,
      panelBorder: getComputedStyle(p).borderTopWidth,
      hintDisplay: hint ? getComputedStyle(hint).display : 'n/a',
      lang: document.documentElement.lang,
    };
  });
  await page.close();
}
console.log(JSON.stringify(out, null, 2));
await b.close();
