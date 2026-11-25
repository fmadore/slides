/** One leaf-slide inventory for navigation, preflight and export counts. */
export async function slideInventory(page) {
  return page.evaluate(() => window.DeckRuntime.leafSlides().map(slide => ({
    ...Reveal.getIndices(slide), id: slide.id,
    title: slide.dataset.toc || slide.querySelector('h1,h2')?.textContent.trim() || slide.id,
    uncounted: slide.dataset.visibility === 'uncounted',
  })));
}

export async function settlePrint(page) {
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.DeckRuntime.ready);
  await page.waitForSelector('.pdf-page');
  await page.evaluate(() => window.DeckRuntime.settle());
}

/** Check painted text/media, not just page counts or parent layout boxes. */
export async function printGeometry(page) {
  return page.evaluate(() => [...document.querySelectorAll('.pdf-page')].flatMap((page, index) => {
    const slide = page.querySelector('section');
    const box = page.getBoundingClientRect();
    const imprint = page.querySelector('.pdf-imprint');
    const bottom = imprint ? imprint.getBoundingClientRect().top : box.bottom;
    const failures = [];
    // Walk up to the slide, not past it: reveal's print view leaves `hidden`
    // on every section but the current one (and on their stacks) although all
    // of them are displayed, so a [hidden] test that reached the section would
    // skip every page but one (#40). [hidden] inside the slide still counts.
    const visible = el => {
      for (let p = el; p && p !== slide; p = p.parentElement) {
        if (p.matches('aside, [hidden], .slide-background, .media-fill, .media-scrim, .pdf-imprint')) return false;
        const css = getComputedStyle(p);
        if (css.display === 'none' || css.visibility === 'hidden' || css.opacity === '0') return false;
      }
      return true;
    };
    // Clipping changes painted bounds, not resource readiness. A broken image
    // inside a browser frame still fails even when its parent crops its edges.
    function clipped(rect, element) {
      let { left, right, top, bottom } = rect;
      for (let parent = element.parentElement; parent && parent !== slide; parent = parent.parentElement) {
        const css = getComputedStyle(parent), clip = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(css.overflowX)) {
          left = Math.max(left, clip.left); right = Math.min(right, clip.right);
        }
        if (/auto|scroll|hidden|clip/.test(css.overflowY)) {
          top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom);
        }
      }
      return { left, right, top, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    }
    // Name the edge crossed and by how much (worst case per label), with the
    // slide's auto-fit scale: a CI-only failure must be diagnosable from the log.
    const overruns = new Map();
    function inspect(rect, label) {
      if (!rect.width || !rect.height) return;
      const over = { left: box.left - rect.left, right: rect.right - box.right, top: box.top - rect.top, bottom: rect.bottom - bottom };
      if (Object.values(over).every(px => px <= 2)) return;
      const worst = overruns.get(label) || {};
      for (const [edge, px] of Object.entries(over)) if (px > 2) worst[edge] = Math.max(worst[edge] || 0, px);
      overruns.set(label, worst);
    }
    function reportOverruns() {
      const fit = slide.dataset.fit ? `, fit ×${slide.dataset.fit}` : '';
      for (const [label, worst] of overruns) {
        const edges = Object.entries(worst).map(([edge, px]) => `${edge} +${Math.round(px)}px`).join(', ');
        failures.push(`page ${index + 1}: ${label} outside content bounds (${edges}${fit})`);
      }
    }
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || !visible(node.parentElement)) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const rect of range.getClientRects()) inspect(clipped(rect, node.parentElement), node.textContent.trim().slice(0, 50));
    }
    slide.querySelectorAll('img').forEach(img => {
      if (!visible(img)) return;
      if (!img.complete || !img.naturalWidth) failures.push(`page ${index + 1}: image failed: ${img.alt}`);
      inspect(clipped(img.getBoundingClientRect(), img), `image ${img.alt.slice(0, 40)}`);
    });
    slide.querySelectorAll('figure').forEach(figure => {
      const image = figure.querySelector('img'), caption = figure.querySelector('figcaption');
      if (!image || !caption || !visible(image) || !visible(caption)) return;
      const a = clipped(image.getBoundingClientRect(), image), b = clipped(caption.getBoundingClientRect(), caption);
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) {
        failures.push(`page ${index + 1}: image overlaps its caption`);
      }
    });
    reportOverruns();
    if (!imprint) failures.push(`page ${index + 1}: missing imprint`);
    return [...new Set(failures)];
  }));
}
