import assert from 'node:assert/strict';
import { settleAnimations } from './a11y.mjs';
import { settlePrint, printGeometry } from './slides.mjs';
import { checkRuntimeRegressions } from './runtime-regressions.mjs';

async function hermeticContext(browser, base, diagnostics, label, options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce', ...options });
  if (diagnostics) await diagnostics.attach(ctx, label);
  await ctx.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  return ctx;
}

async function openDeck(page, base, deck) {
  await page.goto(`${base}/talks/${deck}/`);
  await page.evaluate(() => window.DeckRuntime.ready);
  await page.evaluate(() => window.DeckRuntime.settle());
}

/** The ZMO skin restyles chrome the Broadsheet journeys never open. On its
 *  starter deck: the contents overlay's rows must not inherit the skin's list
 *  bullets or hanging indent, and on a dark-register slide (footer.on-dark)
 *  a keyboard-focused nav control must draw a ring that shows against the
 *  skin's white pill — WCAG 2.4.7 / 1.4.11, so 3:1 against the pill. */
export async function checkBrandChrome(browser, base, diagnostics = null, deck = '_template-zmo') {
  const ctx = await hermeticContext(browser, base, diagnostics, 'brand-chrome');
  try {
    const page = await ctx.newPage();
    await openDeck(page, base, deck);
    assert.equal(await page.evaluate(() => document.body.dataset.brand), 'zmo', `${deck} is not a ZMO-skin deck`);

    await page.keyboard.press('t');
    await page.locator('.toc-overlay').waitFor({ state: 'visible' });
    const rows = await page.locator('.toc-list > li').evaluateAll(items => items.map(li => ({
      label: li.textContent.trim().replace(/\s+/g, ' ').slice(0, 30),
      marker: getComputedStyle(li, '::before').content,
      padding: getComputedStyle(li).paddingLeft,
    })));
    assert.ok(rows.length > 0, 'contents overlay lists no rows');
    const marked = rows.filter(row => !['none', 'normal'].includes(row.marker)).map(row => `${row.label} (${row.marker})`);
    const indented = rows.filter(row => row.padding !== '0px').map(row => `${row.label} (${row.padding})`);
    assert.deepEqual(marked, [], 'ZMO contents rows carry a list marker');
    assert.deepEqual(indented, [], 'ZMO contents rows carry list padding');
    await page.keyboard.press('Escape');
    await page.locator('.toc-overlay').waitFor({ state: 'hidden' });

    const dark = await page.evaluate(async () => {
      for (const leaf of window.DeckRuntime.leafSlides()) {
        const { h, v = 0 } = Reveal.getIndices(leaf);
        Reveal.slide(h, v);
        await window.DeckRuntime.settle();
        if (document.querySelector('.deck-footer').classList.contains('on-dark')) return `#${h + 1}.${v}`;
      }
      return null;
    });
    assert.ok(dark, `${deck} has no dark-register slide to test the nav focus ring on`);
    const controls = await page.locator('.deck-nav button:not([disabled])').count();
    assert.ok(controls > 0, 'no enabled nav controls');
    for (let i = 0; i < controls; i++) {
      const button = page.locator('.deck-nav button:not([disabled])').nth(i);
      // A key press first, so the programmatic focus counts as keyboard focus.
      await page.keyboard.press('Shift');
      await button.focus();
      await settleAnimations(page);
      const ring = await button.evaluate(el => {
        const canvas = Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
        const paint = canvas.getContext('2d', { willReadFrequently: true });
        const rgb = color => {   // any CSS colour, composited on white, as sRGB
          paint.fillStyle = '#fff'; paint.fillRect(0, 0, 1, 1);
          paint.fillStyle = color; paint.fillRect(0, 0, 1, 1);
          return [...paint.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const luminance = c => c.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          .reduce((sum, v, k) => sum + v * [0.2126, 0.7152, 0.0722][k], 0);
        const nav = el.closest('.deck-nav'), cs = getComputedStyle(el), pill = getComputedStyle(nav).backgroundColor;
        const [a, b] = [luminance(rgb(cs.outlineColor)), luminance(rgb(pill))];
        return { name: el.getAttribute('aria-label') || el.className, focusVisible: el.matches(':focus-visible'),
          style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, pill,
          opacity: getComputedStyle(nav).opacity, contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
      const what = `${dark} ${ring.name}`;
      assert.ok(ring.focusVisible, `${what}: focus did not register as keyboard focus`);
      assert.equal(ring.opacity, '1', `${what}: nav pill stays hidden while a control has focus`);
      assert.ok(ring.style !== 'none' && ring.width >= 1, `${what}: no focus outline (${ring.style} ${ring.width}px)`);
      assert.ok(ring.contrast >= 3, `${what}: focus ring ${ring.color} on pill ${ring.pill} is ${ring.contrast.toFixed(2)}:1, needs 3:1`);
    }
    console.log(`ok    brand chrome: ${deck} contents rows unmarked and flush; nav focus ring visible on dark slide ${dark}`);
  } catch (error) {
    diagnostics?.capture('brand chrome', error.stack || String(error));
    throw error;
  } finally {
    await ctx.close();
  }
}

/** --h is a share of the plot, so bar fills must stay proportional: a bar at
 *  100% measures twice one at 50% (±2%) once settled. The fixture reuses the
 *  catalogue's own bar markup, so it follows whatever structure the theme's
 *  chart takes; the fill is the tallest painted box inside a bar outside its
 *  value label, pseudo-elements included. */
export async function checkBarchartGeometry(browser, base, diagnostics = null) {
  const ctx = await hermeticContext(browser, base, diagnostics, 'barchart-geometry');
  try {
    const page = await ctx.newPage();
    await openDeck(page, base, '_showcase');
    await page.evaluate(async () => {
      const chart = document.querySelector('.barchart');
      if (!chart) throw new Error('the catalogue has no .barchart to build the fixture from');
      const template = chart.querySelector('.bar');
      chart.replaceChildren(...['100%', '50%'].map(h => {
        const bar = template.cloneNode(true);
        bar.classList.remove('is-peak', 'is-mute');
        bar.style.setProperty('--h', h);
        bar.dataset.fixture = h;
        return bar;
      }));
      const { h, v = 0 } = Reveal.getIndices(chart.closest('section'));
      Reveal.slide(h, v);
      await window.DeckRuntime.settle();
    });
    await settleAnimations(page);
    const heights = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.bar[data-fixture]')].map(bar => {
      const painted = cs => cs.display !== 'none' && !/rgba\(.*,\s*0\)$|transparent/.test(cs.backgroundColor);
      let tallest = 0;
      for (const el of [bar, ...bar.querySelectorAll('*')]) {
        if (el.closest('.bar-v')) continue;
        if (el !== bar && painted(getComputedStyle(el))) tallest = Math.max(tallest, el.getBoundingClientRect().height);
        for (const pseudo of ['::before', '::after']) {
          const cs = getComputedStyle(el, pseudo);
          if (!['none', 'normal'].includes(cs.content) && painted(cs)) tallest = Math.max(tallest, parseFloat(cs.height) || 0);
        }
      }
      return [bar.dataset.fixture, tallest];
    })));
    assert.ok(heights['50%'] > 0, `no painted fill found in the 50% bar: ${JSON.stringify(heights)}`);
    const ratio = heights['100%'] / heights['50%'];
    assert.ok(Math.abs(ratio - 2) <= 0.04, `bars at --h 100% and 50% measure ${heights['100%'].toFixed(1)}px and ${heights['50%'].toFixed(1)}px (${ratio.toFixed(3)}:1), not 2:1`);
    console.log(`ok    barchart geometry: --h 100% and 50% measure ${ratio.toFixed(3)}:1`);
  } catch (error) {
    diagnostics?.capture('barchart geometry', error.stack || String(error));
    throw error;
  } finally {
    await ctx.close();
  }
}

/** Focused failure journeys, isolated from remote services. */
export async function checkInteractions(browser, base, diagnostics = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  try {
    if (diagnostics) await diagnostics.attach(ctx, 'interactions');
    await ctx.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await ctx.newPage();
    const open = async (deck, query = '') => {
      await page.emulateMedia({ media: 'screen' });
      await page.goto(`${base}/talks/${deck}/${query}`);
      await page.evaluate(() => window.DeckRuntime.ready);
      await page.evaluate(() => window.DeckRuntime.settle());
    };
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
    // The URL write is debounced, so wait for it, not for the keystroke.
    await page.waitForFunction(() => new URLSearchParams(location.search).get('q') === 'OCR');
    // …and a shared filtered URL restores its state on load.
    await page.goto(`${base}/?tag=AMIRA`);
    assert.equal(await page.locator('#f-tag').inputValue(), 'AMIRA');
    const tagged = await page.locator('li.talk').evaluateAll(items =>
      items.filter(li => !li.hidden).map(li => li.dataset.tags.split('|').includes('AMIRA')));
    assert.ok(tagged.length > 0 && tagged.every(Boolean));
    // One outline: h1 masthead, h2 sections, h3 talk titles — no skipped level.
    const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(hs => hs.map(h => +h.tagName[1]));
    assert.ok(levels.every((level, i) => i === 0 || level <= levels[i - 1] + 1), `heading levels skip: ${levels}`);
    await checkRuntimeRegressions(browser, base, diagnostics);
    console.log('ok    interactions: reduced motion, lazy gallery, print aliases/negative geometry, iframe lifecycle, keyboard scroll panel, escaped TOC, TOC keys, copy-link feedback, catalogue search/filters/URL state/outline');
  } catch (error) {
    diagnostics?.capture('interactions', error.stack || String(error));
    throw error;
  } finally {
    await ctx.close();
  }
}
