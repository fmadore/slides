import { chromium } from 'playwright';
const URL = 'http://localhost:8742/talks/_showcase/';
const b = await chromium.launch();
const out = {};

const MARKS = `(sec) => {
  const g = (el, p) => el ? getComputedStyle(el, p) : null;
  const title = sec.querySelector('.slide-title'), kick = sec.querySelector('.kicker');
  const bar = sec.querySelector('.barchart .bar.is-peak'), track = sec.querySelector('.share-track');
  return {
    drawRun: getComputedStyle(sec).getPropertyValue('--draw-run').trim(),
    count: getComputedStyle(sec).getPropertyValue('--count').trim(),
    titleBar: title ? g(title, '::before').transform : null,
    kickTick: kick ? g(kick, '::before').transform : null,
    barH: bar ? g(bar, '::after').height : null,
    trackFill: track ? g(track, '::before').transform : null,
    trackW: track ? g(track, '::before').width : null,
    counts: [...sec.querySelectorAll('[data-count]')].map(e => e.textContent).slice(0, 3),
    anims: document.getAnimations().filter(a => a.animationName).map(a => a.animationName + ':' + a.playState)
  };
}`;

async function shot(label, { reduce = false, deckNoDraw = false, slideNoDraw = false, print = false, atMs = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(URL + (print ? '?print-pdf' : ''), { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  if (!print) {
    await page.evaluate(async ({ deckNoDraw, slideNoDraw }) => {
      if (deckNoDraw) document.querySelector('.reveal').classList.add('no-draw');
      if (slideNoDraw) document.querySelector('[data-toc="Data as design"]').classList.add('no-draw');
      Reveal.slide(17); await new Promise(r => setTimeout(r, 500));
    }, { deckNoDraw, slideNoDraw });
    await page.evaluate(async (atMs) => {
      Reveal.slide(19);
      await new Promise(r => setTimeout(r, atMs === null ? 1400 : atMs));
    }, atMs);
  }
  const sel = print ? '.pdf-page [data-toc="Data as design"], [data-toc="Data as design"]' : '[data-toc="Data as design"]';
  out[label] = await page.evaluate(([sel, fn]) => eval('(' + fn + ')')(document.querySelector(sel)), [sel, MARKS]);
  if (reduce) {
    out[label].reduced = await page.evaluate(() => {
      const v = getComputedStyle(document.querySelector('.reveal-viewport'));
      const panel = getComputedStyle(document.querySelector('.toc-panel'));
      const frag = document.querySelector('.fragment.fade-up');
      return {
        viewportBgTransition: v.transitionProperty + ' / ' + v.transitionDuration,
        tocPanelTransform: panel.transform, tocPanelTransition: panel.transitionDuration,
        fragTransform: frag ? getComputedStyle(frag).transform : 'n/a',
        progressTransition: getComputedStyle(document.querySelector('.progress span')).transitionDuration,
      };
    });
  }
  await ctx.close();
}

await shot('normal-settled');
await shot('normal-midflight', { atMs: 150 });
await shot('deck-no-draw', { deckNoDraw: true, atMs: 60 });
await shot('slide-no-draw', { slideNoDraw: true, atMs: 60 });
await shot('reduced-motion', { reduce: true, atMs: 60 });
await shot('print-pdf', { print: true });
console.log(JSON.stringify(out, null, 2));
await b.close();
