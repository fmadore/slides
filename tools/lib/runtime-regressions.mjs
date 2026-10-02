import assert from 'node:assert/strict';

/** Exercise changes of state that a settled screenshot cannot cover. */
export async function checkRuntimeRegressions(browser, base, diagnostics = null) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  try {
    if (diagnostics) await diagnostics.attach(ctx, 'runtime-regressions');
    await ctx.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await ctx.newPage();
    const open = async deck => {
      await page.goto(`${base}/talks/${deck}/`);
      await page.evaluate(() => window.DeckRuntime.ready);
      await page.evaluate(() => window.DeckRuntime.settle());
    };
    const select = async id => page.evaluate(id => {
      const { h, v } = Reveal.getIndices(document.getElementById(id));
      Reveal.slide(h, v);
    }, id);
    const fitsSafeArea = () => {
      const slide = Reveal.getCurrentSlide();
      const rect = slide.getBoundingClientRect();
      const css = getComputedStyle(slide);
      const bottom = rect.bottom - parseFloat(css.paddingBottom) * Reveal.getScale();
      const fit = slide.querySelector(':scope > .fit');
      // A flex wrapper includes the final child's trailing margin. Measure the
      // actual content boxes, as the fit engine does, rather than that margin.
      const children = [...(fit || slide).children].filter(child => child.tagName !== 'ASIDE' && child.offsetParent !== null &&
        !['absolute', 'fixed'].includes(getComputedStyle(child).position));
      return children.length > 0 && children.every(child => child.getBoundingClientRect().bottom <= bottom + 2) &&
        (!fit || Math.abs(parseFloat(fit.style.left) - parseFloat(css.paddingLeft)) < 1);
    };
    await open('2026-05-06-dga-dormant-collections');

    // Populate the ordinary fit cache at the narrow breakpoint. The second
    // slide fits there without a wrapper, but needs fitting on desktop.
    await select('s-scan');
    await page.evaluate(() => window.DeckRuntime.settle());
    await select('s-nb');
    await page.evaluate(() => window.DeckRuntime.settle());
    await page.setViewportSize({ width: 1280, height: 720 });
    // Do not call settle() after resizing or revisiting a cached slide: that
    // helper forces a refit and used to hide the runtime's missing invalidation.
    await page.waitForFunction(fitsSafeArea, null, { timeout: 5000 });
    await select('s-scan');
    await page.waitForFunction(fitsSafeArea, null, { timeout: 5000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(fitsSafeArea, null, { timeout: 5000 });

    // .shot frames can wrap an image. Each real published example must expose
    // the image's description, display its pixels, and restore its trigger.
    await select('s-kb');
    await page.evaluate(() => window.DeckRuntime.settle());
    const shots = page.locator('#s-kb .shot');
    assert.equal(await shots.count(), 4);
    for (let i = 0; i < 4; i++) {
      const trigger = shots.nth(i);
      const alt = await trigger.locator('img').getAttribute('alt');
      const source = await trigger.locator('img').evaluate(img => img.currentSrc || img.src);
      assert.ok((await trigger.getAttribute('aria-label')).includes(alt));
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(source => {
        const image = document.querySelector('.deck-lightbox img');
        return !image.hidden && image.complete && image.naturalWidth > 0 && image.src === source;
      }, source, { timeout: 5000 });
      assert.equal(await page.locator('.deck-lightbox figcaption').textContent(), alt);
      await page.keyboard.press('Escape');
      await page.locator('.deck-lightbox').waitFor({ state: 'hidden' });
      assert.equal(await trigger.evaluate(element => document.activeElement === element), true);
    }

    // First prove that this native touch gesture navigates the deck. The same
    // quick flick must not change slides behind the open contents dialog.
    const touch = await ctx.newCDPSession(page);
    const swipe = async () => {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 450 }] });
      for (const x of [220, 150, 80]) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 450 }] });
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await page.evaluate(() => Reveal.slide(0, 0));
    await swipe();
    await page.waitForFunction(() => Reveal.getIndices().h === 1);
    await page.evaluate(() => Reveal.slide(0, 0));
    await page.locator('.toc-btn').click();
    await page.locator('.toc-overlay').waitFor({ state: 'visible' });
    await swipe();
    assert.equal(await page.evaluate(() => Reveal.getIndices().h), 0);
    assert.equal(await page.locator('.toc-overlay').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.locator('.toc-overlay').waitFor({ state: 'hidden' });
    await touch.detach();

    // A visible anchor must receive pointer input as well as keyboard focus.
    const logo = page.locator('.foot-logo');
    assert.equal(await logo.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('.foot-logo') === element;
    }), true);
    await logo.evaluate(element => {
      window.logoClicks = 0;
      element.addEventListener('click', event => { event.preventDefault(); window.logoClicks++; });
    });
    await logo.click();
    assert.equal(await page.evaluate(() => window.logoClicks), 1);
    await page.keyboard.press('Tab');
    await logo.focus();
    assert.equal(await logo.evaluate(element => {
      const css = getComputedStyle(element);
      return document.activeElement === element && css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) >= 2;
    }), true);

    // Framing permission is not availability. An aborted trusted iframe must
    // keep its already-vendored screenshot, including after the fallback timer.
    await open('2026-09-17-kansas-ai-and-the-work-of');
    const frameSlide = await page.evaluate(() => {
      const frame = document.querySelector('iframe[data-frame-trusted=""]');
      const { h } = Reveal.getIndices(frame.closest('section'));
      Reveal.slide(h, 0);
      return h;
    });
    await page.evaluate(() => window.DeckRuntime.settle());
    const fallback = page.locator('.present .frame-fallback');
    assert.equal(await fallback.isVisible(), true);
    assert.ok(await fallback.locator('img').evaluate(img => img.complete && img.naturalWidth > 0));
    await page.evaluate(() => document.querySelector('.present iframe').dispatchEvent(new Event('load')));
    await page.waitForTimeout(8250);
    assert.equal(await fallback.isVisible(), true);
    // A matching origin declaration must not bypass the fallback either.
    await page.evaluate(h => {
      document.querySelector('.present iframe').dataset.frameTrusted = location.origin;
      Reveal.slide(h - 1, 0);
      Reveal.slide(h, 0);
    }, frameSlide);
    assert.equal(await fallback.isVisible(), true);
    await fallback.locator('.frame-show').click();
    assert.equal(await fallback.isVisible(), false);
    await page.evaluate(h => { Reveal.slide(h - 1, 0); Reveal.slide(h, 0); }, frameSlide);
    assert.equal(await fallback.isVisible(), true);
    console.log('ok    runtime regressions: resize and cached slides, wrapped gallery, native touch dialog, footer link, trusted iframe offline/opt-in');
  } catch (error) {
    diagnostics?.capture('runtime regressions', error.stack || String(error));
    throw error;
  } finally {
    await ctx.close();
  }
}
