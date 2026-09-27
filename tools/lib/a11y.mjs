/* Automated WCAG checks (axe-core) for tools/browser-check.mjs.
 *
 * WCAG 2.2 AA is the binding bar for the published site (PRODUCT.md). axe
 * reads what a browser can prove from the rendered page — contrast against
 * the ground actually painted, names and roles, keyboard reach into scroll
 * regions, links told apart by more than colour. It cannot judge whether alt
 * text is apt, whether a reading order makes sense, or whether a slide reads
 * from the back of a hall; those stay with review.
 *
 * Each check measures a settled page: slide transitions, fragment fades and
 * colour cross-fades are awaited first, because axe measuring a link halfway
 * through its fade reports a contrast the room never sees.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const AXE_SOURCE = require.resolve('axe-core/axe.min.js');
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/* Decoration that WCAG 1.4.3 exempts as incidental text, which axe cannot
   tell from copy: the ghosted folio is a 224px numeral at about 6% ink,
   aria-hidden, drawn as a pressroom plate behind a field. */
export const DECORATIVE = ['.folio-ghost'];

export async function injectAxe(page) {
  if (!(await page.evaluate(() => typeof window.axe !== 'undefined'))) {
    await page.addScriptTag({ path: AXE_SOURCE });
  }
}

/** Wait until every finite animation and transition on the page has run. */
export async function settleAnimations(page) {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter(animation => {
      const timing = animation.effect && animation.effect.getComputedTiming();
      return timing && Number.isFinite(timing.endTime);
    });
    await Promise.all(finite.map(animation => animation.finished.catch(() => {})));
  });
}

/** Run axe over `include` (selectors; the whole document when omitted) and
 *  return one line per failing node. */
export async function axeFindings(page, include = null) {
  await injectAxe(page);
  await settleAnimations(page);
  return page.evaluate(async ({ include, exclude, tags }) => {
    const context = include ? { include: include.map(s => [s]), exclude: exclude.map(s => [s]) }
                            : { exclude: exclude.map(s => [s]) };
    const result = await window.axe.run(context, {
      runOnly: { type: 'tag', values: tags },
      iframes: false,            // live frames are other sites; their a11y is not this deck's
      resultTypes: ['violations'],
    });
    return result.violations.flatMap(violation => violation.nodes.map(node => {
      const why = (node.any[0] || node.all[0] || node.none[0] || {}).message || violation.help;
      return `${violation.id} (${violation.impact}): ${node.target.join(' ')} — ${why}`;
    }));
  }, { include, exclude: DECORATIVE, tags: WCAG_TAGS });
}

/** Every leaf slide of a deck, fragments shown, with the footer over it; then
 *  the contents dialog, open. Returns [label, finding] pairs. */
export async function auditDeck(page) {
  const findings = [];
  const count = await page.evaluate(() => window.DeckRuntime.leafSlides().length);
  for (let i = 0; i < count; i++) {
    const label = await page.evaluate(async index => {
      const leaf = window.DeckRuntime.leafSlides()[index];
      const { h, v = 0 } = Reveal.getIndices(leaf);
      Reveal.slide(h, v);
      await window.DeckRuntime.settle();
      while (Reveal.nextFragment()) { /* the slide as it finally stands */ }
      return `#${h + 1}.${v}`;
    }, i);
    for (const finding of await axeFindings(page, ['.reveal .slides section.present', '.deck-footer'])) {
      findings.push([label, finding]);
    }
  }
  if (await page.locator('.toc-overlay').count()) {
    await page.evaluate(() => document.querySelector('.toc-btn').click());
    for (const finding of await axeFindings(page, ['.toc-overlay'])) findings.push(['contents', finding]);
    await page.keyboard.press('Escape');
  }
  return findings;
}
