import { chromium } from 'playwright';
const b = await chromium.launch();
const out = {};

// --- 1. the frame cross-fade actually runs now (and interpolates) ---
{
  const page = await (await b.newContext({ viewport: { width: 1400, height: 700 } })).newPage();
  await page.goto('http://localhost:8742/talks/_showcase/', { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  out.frame = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const vp = document.querySelector('.reveal-viewport');
    const cs = () => getComputedStyle(vp);
    Reveal.slide(2); await sleep(800);                       // a light slide
    const light = cs().backgroundColor;
    Reveal.slide(3);                                          // the green divider → deck-dark
    await sleep(120);
    const mid = cs().backgroundColor;
    await sleep(700);
    const dark = cs().backgroundColor;
    return { declared: cs().transitionProperty + ' / ' + cs().transitionDuration, light, mid, dark,
             interpolating: mid !== light && mid !== dark };
  });
  // reduced motion keeps it
  const rpage = await (await b.newContext({ viewport: { width: 1400, height: 700 }, reducedMotion: 'reduce' })).newPage();
  await rpage.goto('http://localhost:8742/talks/_showcase/', { waitUntil: 'load' });
  await rpage.waitForTimeout(1300);
  out.frameReduced = await rpage.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.reveal-viewport'));
    return cs.transitionProperty + ' / ' + cs.transitionDuration;
  });
}

// --- 2. fragments: named transition, and the template steps ---
{
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://localhost:8742/talks/_showcase/', { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  out.fragments = await page.evaluate(() => {
    const plain = document.querySelector('.fragment:not(.fade-up):not(.highlight-green)');
    const hl = document.querySelector('.fragment.highlight-green');
    const g = e => { const c = getComputedStyle(e); return c.transitionProperty + ' / ' + c.transitionDuration; };
    return { plain: g(plain), highlight: g(hl), fadeUp: g(document.querySelector('.fragment.fade-up')) };
  });
}
{
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://localhost:8742/talks/_template/', { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  out.template = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    Reveal.slide(2); await sleep(500);
    const li = () => [...document.querySelectorAll('[data-toc="A key point"] li')].map(e => e.classList.contains('visible'));
    const start = li();
    for (let i = 0; i < 3; i++) { Reveal.next(); await sleep(260); }
    return { start, afterThreeSteps: li(), totalFragments: Reveal.getTotalSlides ? undefined : undefined };
  });
}
console.log(JSON.stringify(out, null, 2));
await b.close();
