import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deckExtrasHash, reusableEvidence } from './export-cache.mjs';
import { publishArtifacts } from './export-artifacts.mjs';
import { captureLiveFrames, installPrintFrameSnapshots } from './pdf-frames.mjs';
import { slideInventory, settlePrint, printGeometry } from './slides.mjs';

export const CACHE_DEPENDENCIES = [
  'package-lock.json', 'tools/export-pdf.mjs', 'tools/lib/export-cache.mjs',
  'tools/lib/export-deck.mjs', 'tools/lib/export-artifacts.mjs',
  'tools/lib/pdf-frames.mjs', 'tools/lib/runtime.mjs', 'tools/lib/slides.mjs',
];

/** Generate and validate one deck in isolation; failure preserves prior outputs. */
export async function exportDeck({ browser, root, repo, base, slug, sharedDigest,
  force = false, refreshFrames = false, frameSnapshots = true, frameTimeoutMs = 12000,
  log = console, publish = publishArtifacts }) {
  const deckDir = join(root, 'talks', slug);
  const hash = deckExtrasHash({ root, repo, slug, sharedDigest, dependencyFiles: CACHE_DEPENDENCIES,
    options: { frameSnapshots, frameTimeoutMs, browser: browser.version() } });
  const hashFile = join(deckDir, '.extras-hash');
  const evidenceFile = join(deckDir, 'export-evidence.json');
  let previous;
  try { previous = JSON.parse(readFileSync(evidenceFile, 'utf8')); } catch { /* rebuild incomplete caches */ }
  if (!force && !refreshFrames && reusableEvidence(previous) && existsSync(hashFile) &&
      readFileSync(hashFile, 'utf8') === hash && previous.sourceDigest === hash &&
      existsSync(join(deckDir, 'slides.pdf')) && existsSync(join(deckDir, 'social-card.png'))) {
    log.log(`ok    ${slug}: unchanged — reusing cached slides.pdf + social-card.png`);
    return { cached: true, evidence: previous };
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    const page = await context.newPage();
    const deckUrl = `${base}/talks/${slug}/`;
    await page.goto(deckUrl, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => window.DeckRuntime.ready);
    const expectedSlides = await slideInventory(page);
    const expectedFrames = await page.evaluate(() => [...document.querySelectorAll('.slides iframe')].map(frame => ({
      title: frame.title, url: new URL(frame.getAttribute('data-src') || frame.getAttribute('src') || '', document.baseURI).href,
      captured: false, status: null, finalUrl: null, captureMode: null, error: 'Capture did not complete',
    })));
    let captures = [];
    if (frameSnapshots && expectedFrames.length) {
      try {
        captures = await captureLiveFrames(page, { timeoutMs: frameTimeoutMs });
        log.log(`info  ${slug}: captured ${captures.filter(frame => frame.dataUrl).length}/${captures.length} live frame(s) for PDF`);
        for (const frame of captures.filter(item => !item.dataUrl)) {
          log.warn(`warn  ${slug}: ${frame.title} — ${frame.error}; using saved view or labelled placeholder`);
        }
      } catch (error) {
        log.warn(`warn  ${slug}: live-frame capture failed (${error.message}); using saved views or labelled placeholders`);
      }
    }

    await page.goto(`${deckUrl}?print-pdf`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForSelector('.reveal .pdf-page', { timeout: 30000 });
    let replacements = { screenshots: 0, authoredFallbacks: 0, placeholders: 0 };
    if (frameSnapshots && expectedFrames.length) {
      replacements = await installPrintFrameSnapshots(page, captures);
      log.log(`info  ${slug}: PDF uses ${replacements.screenshots} capture(s), ${replacements.authoredFallbacks} saved view(s), ${replacements.placeholders} placeholder(s)`);
    }
    await settlePrint(page);
    const geometryErrors = await printGeometry(page);
    if (geometryErrors.length) throw new Error(geometryErrors.join('\n'));
    const slideCount = await page.evaluate(() => document.querySelectorAll('.reveal .pdf-page').length);
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    const pageCount = (pdf.toString('latin1').match(/\/Type[\s]*\/Page[^s]/g) || []).length;
    if (pageCount !== slideCount || slideCount !== expectedSlides.length) {
      throw new Error(`PDF has ${pageCount} pages / ${slideCount} print slides for ${expectedSlides.length} source slides`);
    }

    await page.emulateMedia({ media: 'screen' });
    await page.goto(deckUrl, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => window.DeckRuntime.ready);
    await page.evaluate(() => window.DeckRuntime.settle());
    const socialCard = await page.screenshot({ animations: 'disabled' });
    const evidence = { version: 1, createdAt: new Date().toISOString(), sourceDigest: hash,
      browser: browser.version(), pages: pageCount, options: { frameSnapshots, frameTimeoutMs },
      frames: frameSnapshots ? (captures.length ? captures.map(({ title, url, dataUrl, error, status, finalUrl, captureMode }) =>
        ({ title, url, captured: !!dataUrl, error, status, finalUrl, captureMode })) : expectedFrames) : [],
      replacements, geometry: 'passed', slides: expectedSlides,
    };
    publish(deckDir, { 'slides.pdf': pdf, 'social-card.png': socialCard,
      'export-evidence.json': JSON.stringify(evidence, null, 2) + '\n', '.extras-hash': hash });
    log.log(`ok    ${slug}: slides.pdf (${pageCount} pages, ${(pdf.length / 1024 / 1024).toFixed(1)} MB) + social-card.png`);
    return { cached: false, evidence };
  } finally {
    await context.close();
  }
}

export async function exportLandingCard({ browser, root, base, publish = publishArtifacts }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => document.fonts?.ready);
    const png = await page.screenshot({ animations: 'disabled' });
    publish(root, { 'social-card.png': png });
  } finally {
    await context.close();
  }
}
