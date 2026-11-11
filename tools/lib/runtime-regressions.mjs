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

    // A live frame shows directly, with no opt-in control. What decides is
    // reachability: the engine probes the frame's URL with a no-cors fetch.
    // Recording that probe lets each check wait for the engine's own verdict
    // (its handlers are attached first, so they have run once ours resolves).
    const recordProbe = () => page.evaluate(() => {
      const native = window.fetch;
      window.fetch = (...args) => (window.frameProbe = native(...args));
    });
    const probed = () => page.evaluate(() => window.frameProbe.then(() => true, () => false));
    const reachable = origin => ctx.route(url => url.origin === origin,
      route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stub</title>' }));
    const visit = selector => page.evaluate(selector => {
      const { h, v } = Reveal.getIndices(document.querySelector(selector).closest('section'));
      Reveal.slide(0, 0);
      Reveal.slide(h, v);
      return document.querySelector('.present [data-frame-notice] p')?.textContent ?? null;
    }, selector);
    const frameShown = () => page.evaluate(() => {
      const frame = document.querySelector('.present iframe');
      return frame.style.visibility !== 'hidden' &&
        [...frame.parentElement.querySelectorAll('.frame-fallback')].every(fallback => fallback.hidden);
    });

    // An author's saved view survives an unreachable site, a load event (which
    // blocked and error documents also fire) and the fallback timer.
    await open('2026-09-17-kansas-ai-and-the-work-of');
    await recordProbe();
    assert.equal(await page.locator('.frame-show').count(), 0);
    const trustedAny = 'iframe[data-frame-trusted=""]';
    await visit(trustedAny);
    await page.evaluate(() => window.DeckRuntime.settle());
    const fallback = page.locator('.present .frame-fallback');
    assert.equal(await probed(), false);
    assert.equal(await fallback.isVisible(), true);
    assert.ok(await fallback.locator('img').evaluate(img => img.complete && img.naturalWidth > 0));
    await page.evaluate(() => document.querySelector('.present iframe').dispatchEvent(new Event('load')));
    await page.waitForTimeout(8250);
    assert.equal(await fallback.isVisible(), true);
    // Once the site answers, a trust declaration for any origin, or for this
    // page's origin, lets the saved view give way to the live frame.
    const sentiment = new URL(await page.locator(trustedAny).getAttribute('data-src')).origin;
    await reachable(sentiment);
    await visit(trustedAny);
    assert.equal(await probed(), true);
    assert.equal(await fallback.isVisible(), false);
    assert.equal(await frameShown(), true);
    await page.evaluate(selector => {
      const frame = document.querySelector(selector);
      frame.dataset.frameTrusted = location.origin;
      frame.dataset.thisOrigin = '';
    }, trustedAny);
    await visit('iframe[data-this-origin]');
    assert.equal(await probed(), true);
    assert.equal(await frameShown(), true);
    // Reachable is not enough when the declaration names another origin: the
    // published-site declaration does not cover this local page.
    const elsewhere = 'iframe[data-frame-trusted^="https://"]';
    await reachable(new URL(await page.locator(elsewhere).getAttribute('data-src')).origin);
    await visit(elsewhere);
    assert.equal(await probed(), true);
    assert.equal(await fallback.isVisible(), true);
    assert.equal(await frameShown(), false);
    await ctx.unrouteAll();
    await ctx.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());

    // A frame with no saved view gets the engine's notice: loading while the
    // probe is pending, then a readable unavailable notice with a persistent
    // Open link; once the site answers, the notice gives way to the frame.
    await open('2026-06-29-erlangen-islam-peripheries');
    await recordProbe();
    const bare = 'iframe[src*="islam.zmo.de"], iframe[data-src*="islam.zmo.de"]';
    assert.equal(await visit(bare), 'Loading the site…');
    assert.equal(await probed(), false);
    const notice = page.locator('.present [data-frame-notice]');
    assert.equal(await notice.isVisible(), true);
    assert.equal(await notice.locator('p').textContent(), 'Live view unavailable — it needs a network connection.');
    const openSite = notice.locator('a');
    assert.equal(await openSite.textContent(), 'Open the site ↗');
    assert.equal(await openSite.getAttribute('target'), '_blank');
    assert.equal(await openSite.getAttribute('href'), await page.locator('.present .site-frame-open').getAttribute('href'));
    assert.equal(await page.locator('.frame-show').count(), 0);
    await reachable('https://islam.zmo.de');
    await visit(bare);
    assert.equal(await probed(), true);
    assert.equal(await notice.isVisible(), false);
    assert.equal(await frameShown(), true);
    assert.equal(await page.locator('.present iframe').isVisible(), true);
    console.log('ok    runtime regressions: resize and cached slides, wrapped gallery, native touch dialog, footer link, live frames (saved view, trust, notice, reachability)');
  } catch (error) {
    diagnostics?.capture('runtime regressions', error.stack || String(error));
    throw error;
  } finally {
    await ctx.close();
  }
}
