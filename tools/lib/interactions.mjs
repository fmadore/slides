import assert from 'node:assert/strict';
import { settlePrint, printGeometry } from './slides.mjs';

/** Focused failure journeys, isolated from remote services. */
export async function checkInteractions(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  await ctx.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const page = await ctx.newPage();
  const open = async (deck, query = '') => {
    await page.emulateMedia({ media: 'screen' });
    await page.goto(`${base}/talks/${deck}/${query}`);
    await page.evaluate(() => window.DeckRuntime.ready);
    await page.evaluate(() => window.DeckRuntime.settle());
  };
  try {
    await open('_showcase');
    assert.equal(await page.evaluate(() => Reveal.getConfig().autoAnimate), false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => Reveal.getConfig().autoAnimate);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !Reveal.getConfig().autoAnimate);
    await page.evaluate(async () => {
      const image = document.querySelector('.is-zoomable');
      const { h, v } = Reveal.getIndices(image.closest('section'));
      Reveal.slide(h, v);
      await window.DeckRuntime.settle();
      image.click();
    });
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => {
      const image = document.querySelector('.deck-lightbox img');
      return !image.hidden && image.complete && image.naturalWidth && image.src.includes('example-site.png');
    });
    await page.keyboard.press('Escape');
    await page.locator('.deck-lightbox').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.deck-lightbox').getAttribute('aria-hidden'), 'true');

    for (const query of ['?print-pdf', '?view=print']) {
      await open('_template', query);
      await settlePrint(page);
      assert.equal(await page.locator('.pdf-page').count(), 4);
      assert.equal(await page.locator('.pdf-imprint').count(), 4);
      assert.deepEqual(await printGeometry(page), []);
      // A negative control proves the geometry gate catches visible clipping.
      await page.evaluate(() => { document.querySelector('.pdf-page h1').style.transform = 'translateX(2000px)'; });
      assert.ok((await printGeometry(page)).length > 0);
    }

    await open('2026-06-30-paris-reaf-dh-ia-afrique');
    await page.evaluate(() => Reveal.slide(2));
    await page.waitForFunction(() => !!document.querySelector('.present .frame-fallback:not([hidden])'));
    await page.evaluate(() => document.querySelector('.present iframe').dispatchEvent(new Event('load')));
    assert.equal(await page.locator('.present .frame-fallback').isVisible(), true);
    await page.evaluate(() => {
      const frame = document.querySelector('.present iframe');
      frame.dataset.readyMessage = 'application-ready';
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'application-ready' }, source: frame.contentWindow, origin: 'https://wrong.example' }));
    });
    assert.equal(await page.locator('.present .frame-fallback').isVisible(), true);
    await page.evaluate(() => {
      const frame = document.querySelector('.present iframe');
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'application-ready' }, source: frame.contentWindow, origin: new URL(frame.dataset.src).origin }));
    });
    assert.equal(await page.locator('.present .frame-fallback').isVisible(), false);
    await page.evaluate(() => { Reveal.slide(1); Reveal.slide(2); });
    assert.equal(await page.locator('.present .frame-fallback').isVisible(), true);

    // A scroll panel is reachable from the keyboard: the vertical arrows
    // scroll it in place, while a presenter remote's Page Down still advances
    // the deck and takes focus off the panel it leaves behind.
    await open('2026-09-17-kansas-ai-and-the-work-of');
    const panelSlide = await page.evaluate(async () => {
      const { h } = Reveal.getIndices(document.querySelector('.scroll-panel').closest('section'));
      Reveal.slide(h, 0);
      await window.DeckRuntime.settle();
      return h;
    });
    const panel = page.locator('.present .scroll-panel');
    assert.equal(await panel.getAttribute('tabindex'), '0');
    assert.equal(await panel.getAttribute('role'), 'region');
    await panel.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.querySelector('.present .scroll-panel')?.scrollTop > 0);
    assert.equal(await page.evaluate(() => Reveal.getIndices().h), panelSlide);
    await page.keyboard.press('PageDown');
    await page.waitForFunction(h => Reveal.getIndices().h === h + 1, panelSlide);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('scroll-panel')), false);

    await page.addInitScript(() => {
      let config;
      Object.defineProperty(window, 'DECK_CONFIG', { configurable: true, get: () => config, set: value => {
        value.talkTitle = 'Reading <em>literal</em> & "quoted"';
        config = value;
      } });
    });
    await open('_template');
    assert.equal(await page.locator('.toc-title').textContent(), 'Reading <em>literal</em> & "quoted"');
    assert.equal(await page.locator('.toc-title em').count(), 0);
    await page.keyboard.press('t');
    await page.locator('.toc-overlay').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.toc-overlay').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.locator('.toc-overlay').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.toc-overlay').isVisible(), false);
    // The dialog's footer advertises T and O: both must act from inside it.
    await page.keyboard.press('t');
    await page.locator('.toc-overlay').waitFor({ state: 'visible' });
    await page.keyboard.press('t');
    await page.locator('.toc-overlay').waitFor({ state: 'hidden' });
    await page.keyboard.press('t');
    await page.locator('.toc-overlay').waitFor({ state: 'visible' });
    await page.keyboard.press('o');
    await page.locator('.toc-overlay').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => Reveal.isOverview()), true);
    await page.evaluate(() => Reveal.toggleOverview(false));
    let copied;
    await page.exposeFunction('recordCopiedLink', value => { copied = value; });
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: window.recordCopiedLink } }));
    await page.locator('.copy-link').click();
    assert.ok(copied?.includes('#/'));
    // Confirmation a sighted presenter can see, announced, then reset so the
    // next copy is shown and announced again.
    await page.locator('.copy-link.is-copied').waitFor();
    assert.ok((await page.locator('.deck-status').textContent()).length > 0);
    await page.locator('.copy-link:not(.is-copied)').waitFor({ timeout: 5000 });
    assert.equal(await page.locator('.deck-status').textContent(), '');

    await page.goto(base);
    const totalTalks = await page.locator('li.talk').count();
    await page.locator('#f-q').fill('frederick');
    assert.ok(await page.locator('li.talk:visible').count() > 0);
    await page.locator('#f-q').fill('no-such-talk-123456');
    assert.equal(await page.locator('li.talk:visible').count(), 0);
    await page.locator('#clear-filters').click();
    assert.equal(await page.locator('li.talk:visible').count(), totalTalks);
    assert.equal(await page.locator('#f-q').inputValue(), '');
    // Topic tags are searchable, not only filterable, and the query is
    // mirrored into the URL so a filtered view can be shared.
    const numberOf = href => page.locator(`a.talk-row[href*="${href}"]`)
      .evaluate(a => getComputedStyle(a, '::before').content);
    const dgaNumber = await numberOf('dga-dormant-collections');
    await page.locator('#f-q').fill('OCR');
    assert.equal(await page.locator('li.talk:visible a.talk-row[href*="dga-dormant-collections"]').count(), 1);
    // A talk's number is its own: filtering the list does not renumber it.
    assert.equal(await numberOf('dga-dormant-collections'), dgaNumber);
    assert.equal(new URL(page.url()).searchParams.get('q'), 'OCR');
    // …and a shared filtered URL restores its state on load.
    await page.goto(`${base}/?tag=AMIRA`);
    assert.equal(await page.locator('#f-tag').inputValue(), 'AMIRA');
    const tagged = await page.locator('li.talk').evaluateAll(items =>
      items.filter(li => !li.hidden).map(li => li.dataset.tags.split('|').includes('AMIRA')));
    assert.ok(tagged.length > 0 && tagged.every(Boolean));
    // One outline: h1 masthead, h2 sections, h3 talk titles — no skipped level.
    const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(hs => hs.map(h => +h.tagName[1]));
    assert.ok(levels.every((level, i) => i === 0 || level <= levels[i - 1] + 1), `heading levels skip: ${levels}`);
    console.log('ok    interactions: reduced motion, lazy gallery, print aliases/negative geometry, iframe lifecycle, keyboard scroll panel, escaped TOC, TOC keys, copy-link feedback, catalogue search/filters/URL state/outline');
  } finally {
    await ctx.close();
  }
}
