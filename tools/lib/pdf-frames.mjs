import { PNG } from 'pngjs';

const KEY_SEPARATOR = '\u0000';

function errorSummary(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(/\r?\n/, 1)[0];
}

export function frameKey(url, occurrence) {
  return `${url || ''}${KEY_SEPARATOR}${occurrence}`;
}

/** Reject a uniform/near-uniform frame capture instead of embedding a white box. */
export function pngHasVisibleContent(buffer) {
  let png;
  try {
    png = PNG.sync.read(buffer);
  } catch {
    return false;
  }
  if (!png.width || !png.height) return false;
  const reference = [png.data[0], png.data[1], png.data[2], png.data[3]];
  let different = 0;
  const pixels = png.width * png.height;
  const needed = Math.max(24, Math.ceil(pixels * 0.0002));
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const delta = Math.max(
      Math.abs(png.data[offset] - reference[0]),
      Math.abs(png.data[offset + 1] - reference[1]),
      Math.abs(png.data[offset + 2] - reference[2]),
      Math.abs(png.data[offset + 3] - reference[3]),
    );
    if (delta > 12 && ++different >= needed) return true;
  }
  return false;
}

async function captureTopLevel(page, item, dimensions, { timeoutMs, settleMs }) {
  const parsed = new URL(item.url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('frame URL is not http(s)');
  const direct = await page.context().newPage();
  try {
    await direct.setViewportSize({
      width: Math.max(320, Math.min(1600, dimensions.width)),
      height: Math.max(180, Math.min(1200, dimensions.height)),
    });
    await direct.goto(item.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await direct.evaluate(() => document.fonts?.ready || Promise.resolve()).catch(() => {});
    await direct.waitForTimeout(settleMs);
    const png = await direct.screenshot({ type: 'png', animations: 'disabled', timeout: timeoutMs });
    if (!pngHasVisibleContent(png)) throw new Error('top-level capture was visually blank');
    return png;
  } finally {
    await direct.close();
  }
}

/**
 * Visit every slide containing an iframe in the interactive deck and capture
 * the painted iframe surface. Failures are records too: the print pass turns
 * them into an explicit "live content" placeholder instead of a white box.
 */
export async function captureLiveFrames(page, { timeoutMs = 12000, settleMs = 1600 } = {}) {
  const metadata = await page.evaluate(separator => {
    const seen = new Map();
    return [...document.querySelectorAll('.reveal .slides iframe')].map((frame, id) => {
      const url = frame.getAttribute('src') || frame.getAttribute('data-src') || '';
      const occurrence = seen.get(url) || 0;
      seen.set(url, occurrence + 1);
      frame.dataset.pdfCaptureId = String(id);
      const slide = frame.closest('section');
      const indices = window.Reveal?.getIndices(slide) || { h: 0, v: 0 };
      const rect = frame.getBoundingClientRect();
      return {
        id,
        key: `${url}${separator}${occurrence}`,
        url,
        title: frame.getAttribute('title') || 'Live web content',
        h: indices.h || 0,
        v: indices.v || 0,
        width: Math.max(1, Math.round(rect.width || frame.clientWidth || 960)),
        height: Math.max(1, Math.round(rect.height || frame.clientHeight || 360)),
      };
    });
  }, KEY_SEPARATOR);

  const captures = [];
  for (const item of metadata) {
    const locator = page.locator(`iframe[data-pdf-capture-id="${item.id}"]`);
    let dimensions = { width: item.width, height: item.height };
    try {
      await page.evaluate(({ id, h, v }) => {
        window.Reveal?.slide(h, v);
        const frame = document.querySelector(`iframe[data-pdf-capture-id="${id}"]`);
        if (frame && !frame.getAttribute('src') && frame.getAttribute('data-src')) {
          frame.setAttribute('src', frame.getAttribute('data-src'));
        }
      }, item);
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });
      const box = await locator.boundingBox();
      if (box?.width > 1 && box?.height > 1) {
        dimensions = { width: Math.round(box.width), height: Math.round(box.height) };
      }

      const handle = await locator.elementHandle();
      let child = handle && await handle.contentFrame();
      const deadline = Date.now() + timeoutMs;
      while ((!child || child.url() === 'about:blank') && Date.now() < deadline) {
        await page.waitForTimeout(150);
        child = handle && await handle.contentFrame();
      }
      if (!child || child.url() === 'about:blank' || child.url().startsWith('chrome-error://')) {
        throw new Error('frame did not load');
      }
      await child.waitForLoadState('domcontentloaded', { timeout: Math.max(1000, deadline - Date.now()) });
      await child.evaluate(() => document.fonts?.ready || Promise.resolve()).catch(() => {});
      await page.waitForTimeout(settleMs);

      const fallbackVisible = await locator.evaluate(frame => Boolean(
        frame.parentElement?.querySelector('.frame-fallback:not([hidden]), .viz-fallback:not([hidden])'),
      ));
      if (fallbackVisible) throw new Error('deck fallback is visible');

      const png = await locator.screenshot({ type: 'png', animations: 'disabled', timeout: timeoutMs });
      if (!pngHasVisibleContent(png)) throw new Error('capture was visually blank');
      captures.push({
        ...item,
        ...dimensions,
        dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      });
    } catch (embeddedError) {
      try {
        const png = await captureTopLevel(page, item, dimensions, { timeoutMs, settleMs });
        captures.push({
          ...item,
          ...dimensions,
          dataUrl: `data:image/png;base64,${png.toString('base64')}`,
          captureMode: 'top-level',
        });
      } catch (directError) {
        captures.push({
          ...item,
          ...dimensions,
          dataUrl: null,
          error: `${errorSummary(embeddedError)}; direct capture failed: ${errorSummary(directError)}`,
        });
      }
    }
  }
  return captures;
}

/** Replace print-view iframes with captured images or a useful static notice. */
export async function installPrintFrameSnapshots(page, captures) {
  const result = await page.evaluate(({ records, separator }) => {
    const byKey = new Map(records.map(record => [record.key, record]));
    const seen = new Map();
    let screenshots = 0;
    let placeholders = 0;

    const style = document.createElement('style');
    style.id = 'pdf-frame-snapshot-styles';
    style.textContent = `
      .pdf-frame-capture {
        display: block !important; width: 100% !important; max-width: none !important;
        margin: 0 !important; border: 0 !important; object-fit: cover;
        object-position: top center; background: #fff;
      }
      .pdf-frame-placeholder {
        box-sizing: border-box; width: 100%; display: flex !important;
        flex-direction: column; align-items: center; justify-content: center;
        gap: 0.55rem; padding: 2rem; text-align: center;
        color: var(--ink-soft); background: var(--sunken);
      }
      .pdf-frame-placeholder .pdf-frame-label {
        font-family: var(--font-label); font-size: var(--fs-footer); font-weight: 700;
        letter-spacing: var(--track-label); text-transform: uppercase; color: var(--green-deep);
      }
      .pdf-frame-placeholder strong {
        max-width: 44ch; font-family: var(--font-serif); font-size: var(--fs-small);
        color: var(--ink-bold);
      }
      .pdf-frame-placeholder small {
        max-width: 70ch; overflow-wrap: anywhere; font-family: var(--font-mono);
        font-size: var(--fs-caption); color: var(--ink-soft);
      }
    `;
    document.head.appendChild(style);

    for (const frame of [...document.querySelectorAll('.reveal .slides iframe')]) {
      const url = frame.getAttribute('src') || frame.getAttribute('data-src') || '';
      const occurrence = seen.get(url) || 0;
      seen.set(url, occurrence + 1);
      const record = byKey.get(`${url}${separator}${occurrence}`);
      const height = Math.max(120, record?.height || frame.getBoundingClientRect().height || frame.clientHeight || 360);
      let replacement;
      if (record?.dataUrl) {
        replacement = document.createElement('img');
        replacement.src = record.dataUrl;
        replacement.alt = frame.getAttribute('title') || 'Snapshot of live web content';
        replacement.className = `${frame.className || ''} pdf-frame-capture`.trim();
        screenshots += 1;
      } else {
        replacement = document.createElement('div');
        replacement.className = `${frame.className || ''} pdf-frame-placeholder`.trim();
        const label = document.createElement('span');
        label.className = 'pdf-frame-label';
        label.textContent = 'Live content';
        const title = document.createElement('strong');
        title.textContent = frame.getAttribute('title') || 'Interactive web content';
        const address = document.createElement('small');
        address.textContent = url;
        replacement.append(label, title, address);
        placeholders += 1;
      }
      replacement.style.height = `${height}px`;
      replacement.dataset.pdfFrameState = record?.dataUrl ? 'screenshot' : 'placeholder';
      frame.replaceWith(replacement);
    }
    return { screenshots, placeholders };
  }, { records: captures, separator: KEY_SEPARATOR });

  await page.evaluate(async () => {
    const images = [...document.querySelectorAll('img.pdf-frame-capture')];
    await Promise.all(images.map(image => image.decode?.().catch(() => {}) || Promise.resolve()));
  });
  return result;
}
