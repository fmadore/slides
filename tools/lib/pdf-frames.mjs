import { PNG } from 'pngjs';

const KEY_SEPARATOR = '\u0000';

function errorSummary(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(/\r?\n/, 1)[0];
}

function responseEvidence(response, url, captureMode) {
  return { status: response?.status() ?? null, finalUrl: response?.url() || url, captureMode };
}

function checkResponse(response, url, captureMode) {
  const evidence = responseEvidence(response, url, captureMode);
  if (!response || !response.ok()) {
    throw Object.assign(new Error(response ? `HTTP ${evidence.status}` : 'no document response'), evidence);
  }
  return evidence;
}

async function settleFonts(page, timeoutMs) {
  // Third-party font requests can stay pending indefinitely. Bound this wait
  // inside the browser; closing a failed capture must not leave work behind.
  await page.evaluate(timeout => Promise.race([
    document.fonts?.ready || Promise.resolve(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('font readiness timed out')), timeout)),
  ]), timeoutMs);
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
  // An iframe's decorative border is not evidence that its document painted.
  const inset = Math.min(4, Math.floor(Math.min(png.width, png.height) / 4));
  const first = (inset * png.width + inset) * 4;
  const reference = [...png.data.subarray(first, first + 4)];
  let different = 0;
  const pixels = (png.width - inset * 2) * (png.height - inset * 2);
  const needed = Math.max(24, Math.ceil(pixels * 0.0002));
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const pixel = offset / 4, x = pixel % png.width, y = Math.floor(pixel / png.width);
    if (x < inset || y < inset || x >= png.width - inset || y >= png.height - inset) continue;
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
  let evidence = { status: null, finalUrl: item.url, captureMode: 'top-level' };
  try {
    await direct.setViewportSize({
      width: Math.max(320, Math.min(1600, dimensions.width)),
      height: Math.max(180, Math.min(1200, dimensions.height)),
    });
    const response = await direct.goto(item.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    evidence = responseEvidence(response, item.url, 'top-level');
    checkResponse(response, item.url, 'top-level');
    await settleFonts(direct, timeoutMs);
    await direct.waitForTimeout(settleMs);
    const png = await direct.screenshot({ type: 'png', animations: 'disabled', timeout: timeoutMs });
    if (!pngHasVisibleContent(png)) throw new Error('top-level capture was visually blank');
    return { png, ...evidence };
  } catch (error) {
    throw Object.assign(error, evidence);
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
      const sourceUrl = frame.getAttribute('data-src') || frame.getAttribute('src') || '';
      const occurrence = seen.get(sourceUrl) || 0;
      seen.set(sourceUrl, occurrence + 1);
      frame.dataset.pdfCaptureId = String(id);
      const slide = frame.closest('section');
      const indices = window.Reveal?.getIndices(slide) || { h: 0, v: 0 };
      const rect = frame.getBoundingClientRect();
      return {
        id,
        key: `${sourceUrl}${separator}${occurrence}`,
        url: new URL(sourceUrl, document.baseURI).href,
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
    let embeddedEvidence = { status: null, finalUrl: item.url, captureMode: 'embedded' };
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
      // Reload the document to obtain its real navigation response even if it
      // loaded before capture began. A load event also fires for HTTP errors.
      const response = await child.goto(item.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      embeddedEvidence = checkResponse(response, item.url, 'embedded');
      await settleFonts(child, timeoutMs);
      await page.waitForTimeout(settleMs);

      const fallbackVisible = await locator.evaluate(frame => Boolean(
        frame.parentElement?.querySelector('.frame-fallback:not([hidden]), .viz-fallback:not([hidden]), .amrc-fallback:not([hidden])'),
      ));
      if (fallbackVisible) throw new Error('deck fallback is visible');

      const png = await locator.screenshot({ type: 'png', animations: 'disabled', timeout: timeoutMs });
      if (!pngHasVisibleContent(png)) throw new Error('capture was visually blank');
      captures.push({
        ...item,
        ...dimensions,
        ...embeddedEvidence,
        dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      });
    } catch (embeddedError) {
      try {
        const { png, ...evidence } = await captureTopLevel(page, item, dimensions, { timeoutMs, settleMs });
        captures.push({
          ...item,
          ...dimensions,
          dataUrl: `data:image/png;base64,${png.toString('base64')}`,
          ...evidence,
        });
      } catch (directError) {
        captures.push({
          ...item,
          ...dimensions,
          dataUrl: null,
          status: directError.status ?? embeddedError.status ?? embeddedEvidence.status,
          finalUrl: directError.finalUrl || embeddedError.finalUrl || embeddedEvidence.finalUrl,
          captureMode: 'top-level',
          error: `${errorSummary(embeddedError)}; direct capture failed: ${errorSummary(directError)}`,
        });
      }
    }
  }
  return captures;
}

/** Replace print-view iframes with captured images or a useful static notice. */
export async function installPrintFrameSnapshots(page, captures) {
  const result = await page.evaluate(async ({ records, separator }) => {
    const byKey = new Map(records.map(record => [record.key, record]));
    const seen = new Map();
    let screenshots = 0;
    let placeholders = 0;
    let authoredFallbacks = 0;

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
      const url = frame.getAttribute('data-src') || frame.getAttribute('src') || '';
      const occurrence = seen.get(url) || 0;
      seen.set(url, occurrence + 1);
      const record = byKey.get(`${url}${separator}${occurrence}`);
      const height = Math.max(120, record?.height || frame.getBoundingClientRect().height || frame.clientHeight || 360);
      let replacement;
      const fallbacks = [...frame.parentElement.querySelectorAll('.frame-fallback, .viz-fallback, .amrc-fallback')];
      const authored = fallbacks.map(fallback => fallback.matches('img') ? fallback : fallback.querySelector('img'))
        .find(image => image && (image.getAttribute('data-src') || image.getAttribute('src')));
      let authoredImage;
      if (!record?.dataUrl && authored) {
        const source = new URL(authored.getAttribute('data-src') || authored.getAttribute('src'), document.baseURI);
        // Prefer a checked local screenshot over an unavailable live site.
        if (source.origin === location.origin || source.protocol === 'data:') {
          const candidate = new Image();
          candidate.src = source.href;
          try { await candidate.decode(); if (candidate.naturalWidth) authoredImage = candidate; } catch { /* labelled fallback below */ }
        }
      }
      if (record?.dataUrl) {
        replacement = document.createElement('img');
        replacement.src = record.dataUrl;
        replacement.alt = frame.getAttribute('title') || 'Snapshot of live web content';
        replacement.className = `${frame.className || ''} pdf-frame-capture`.trim();
        screenshots += 1;
      } else if (authoredImage) {
        replacement = authoredImage;
        replacement.alt = authored.alt || frame.title || 'Saved view of live web content';
        replacement.className = `${frame.className || ''} pdf-frame-capture`.trim();
        replacement.style.objectFit = 'contain';
        authoredFallbacks += 1;
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
      replacement.dataset.pdfFrameState = record?.dataUrl ? 'screenshot' : authoredImage ? 'authored-fallback' : 'placeholder';
      fallbacks.forEach(fallback => { fallback.hidden = true; });
      frame.replaceWith(replacement);
    }
    return { screenshots, authoredFallbacks, placeholders };
  }, { records: captures, separator: KEY_SEPARATOR });

  await page.evaluate(async () => {
    const images = [...document.querySelectorAll('img.pdf-frame-capture')];
    await Promise.all(images.map(image => image.decode?.().catch(() => {}) || Promise.resolve()));
  });
  return result;
}
