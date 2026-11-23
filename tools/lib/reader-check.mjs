/* Reading editions must remain useful without script, network embeds or a
 * scaled slide canvas. Run against source and the actual publication build. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { listDecks } from './runtime.mjs';
import { axeFindings } from './a11y.mjs';

/* Text that reads as one word: an inline element whose last letter meets the
   next inline sibling's first letter with no whitespace node between them and
   no visible gap — "<span>Personae</span><span>Texts</span>" shows and is read
   as "PersonaeTexts". Flex/grid items are blockified, so a styled row passes. */
function runTogetherText() {
  const inline = el => getComputedStyle(el).display.startsWith('inline') && el.getClientRects().length;
  const out = [];
  for (const parent of document.querySelectorAll('.reader-slide *')) {
    for (const a of parent.children) {
      const b = a.nextSibling;
      if (!b || b.nodeType !== Node.ELEMENT_NODE || !inline(a) || !inline(b)) continue;
      const left = a.textContent, right = b.textContent;
      if (!/\p{L}$/u.test(left) || !/^\p{L}/u.test(right)) continue;
      const ra = [...a.getClientRects()].at(-1), rb = b.getClientRects()[0];
      const sameLine = ra.top < rb.bottom && rb.top < ra.bottom;
      const em = parseFloat(getComputedStyle(parent).fontSize);
      if (sameLine && rb.left - ra.right < 0.2 * em) out.push(`"${left.trim().slice(-20)}" + "${right.trim().slice(0, 20)}"`);
    }
  }
  return out;
}

/* A numbered step list must show one number: a list marker (or a counter in
   ::before) beside an authored .pipeline-number reads "1. 1". */
function doubleNumbers() {
  return [...document.querySelectorAll('.pipeline-steps > li')].filter(li => {
    const own = li.querySelector('.pipeline-number');
    if (!own || !own.getClientRects().length || getComputedStyle(own).visibility === 'hidden') return false;
    const cs = getComputedStyle(li);
    const marker = cs.display === 'list-item' && (cs.listStyleType !== 'none' || cs.listStyleImage !== 'none');
    return marker || /counter/.test(getComputedStyle(li, '::before').content);
  }).map(li => li.textContent.trim().replace(/\s+/g, ' ').slice(0, 40));
}

export async function checkReaders({ browser, root, base, fail, ok, diagnostics = null, only = null }) {
    const decks = listDecks(root, { includeDrafts: false }).filter(deck => !only || only.includes(deck));
    for (const deck of decks) {
      const where = `${deck}/read.html`;
      if (!existsSync(join(root, 'talks', deck, 'read.html'))) {
        fail(where, 'reading edition missing; run tools/build-index.py');
        continue;
      }
      let context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
      if (diagnostics) context = await diagnostics.attach(context, 'reader');
      const page = await context.newPage();
      const problems = [];
      await page.route('**/*', route => {
        if (route.request().url().startsWith(base)) return route.continue();
        problems.push(`offline reader requested ${route.request().url()}`);
        return route.abort();
      });
      page.on('response', response => {
        if (response.url().startsWith(base) && response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      try {
        await page.goto(`${base}/talks/${deck}/read.html`, { waitUntil: 'load' });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map(image => {
            image.loading = 'eager';
            return image.decode().catch(() => {});
          }));
        });
        const semantics = await page.evaluate(() => ({
          h1: document.querySelectorAll('h1').length,
          slides: document.querySelectorAll('.reader-slide').length,
          forbidden: document.querySelectorAll('iframe,script,[data-notes],aside.notes,[data-private]').length,
          unlabeled: [...document.querySelectorAll('.reader-slide')].filter(slide => !document.getElementById(slide.getAttribute('aria-labelledby'))).length,
          broken: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.getAttribute('src')),
          missingTargets: [...document.querySelectorAll('a[href^="#"]')].filter(link => !document.getElementById(link.getAttribute('href').slice(1))).map(link => link.getAttribute('href')),
          placeholders: /Loading (the extraction|the skill file)/.test(document.body.textContent),
        }));
        if (semantics.h1 !== 1 || !semantics.slides || semantics.unlabeled) problems.push(`invalid reader outline: ${JSON.stringify(semantics)}`);
        if (semantics.forbidden) problems.push('interactive runtime or private note markup remains');
        if (semantics.broken.length) problems.push(`unreadable local figures: ${semantics.broken.join(', ')}`);
        if (semantics.missingTargets.length) problems.push(`broken content links: ${semantics.missingTargets.join(', ')}`);
        if (semantics.placeholders) problems.push('runtime text asset was not inlined');
        for (const run of await page.evaluate(runTogetherText)) problems.push(`run-together text: ${run}`);
        for (const step of await page.evaluate(doubleNumbers)) problems.push(`pipeline step numbered twice: ${step}`);
        for (const fontSize of ['100%', '200%']) {
          await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
          const layout = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            textSize: parseFloat(getComputedStyle(document.querySelector('.reader-slide p')).fontSize),
            transform: getComputedStyle(document.querySelector('.reader-slide')).transform,
          }));
          if (layout.scroll > layout.width + 1) problems.push(`${fontSize} text: horizontal document overflow (${layout.scroll}px at ${layout.width}px)`);
          if (layout.textSize < 13 || layout.transform !== 'none') problems.push(`${fontSize} text: content uses a scaled or unreadable canvas`);
        }
      } catch (error) {
        problems.push(error.message);
      } finally {
        problems.forEach(problem => fail(where, problem));
        // The diagnostic context waits for pending screenshots before closing.
        await context.close();
      }
      // axe itself requires script; keep this separate from the no-script
      // reader check above so the document never gains a runtime dependency.
      let accessibleContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      if (diagnostics) accessibleContext = await diagnostics.attach(accessibleContext, 'reader-a11y');
      try {
        const accessiblePage = await accessibleContext.newPage();
        await accessiblePage.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
        await accessiblePage.goto(`${base}/talks/${deck}/read.html`, { waitUntil: 'load' });
        await accessiblePage.evaluate(() => document.fonts.ready);
        for (const finding of await axeFindings(accessiblePage)) {
          problems.push(finding);
          fail(where, finding);
        }
      } catch (error) {
        problems.push(error.message);
        fail(where, error.message);
      } finally {
        await accessibleContext.close();
      }
      if (!problems.length) ok(where, 'offline, no-script reading at 390px / 200% text; figures, outline, anchors and WCAG checks');
    }
}
