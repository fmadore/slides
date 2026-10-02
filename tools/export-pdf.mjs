#!/usr/bin/env node
/* Export a notes-free PDF and a social-card image for every published deck.
 *
 * Run against the publication build (so the PDFs are notes-free):
 *   python3 tools/strip-notes.py _site
 *   node tools/export-pdf.mjs --root _site
 *
 * For each talks/<slug>/ in --root it writes, next to the deck:
 *   slides.pdf       — reveal's ?print-pdf export, one page per slide,
 *                      backgrounds rendered; the page count is verified
 *                      against the deck's slide count
 *   social-card.png  — a 1280×720 screenshot of the cover slide (the
 *                      og:image each deck's metadata points to)
 *
 * It also writes <root>/social-card.png, the same 1280×720 shot of the
 * landing page, which is the og:image for the site root and doubles as the
 * repository's GitHub social preview.
 *
 * Incremental: a content hash of the deck folder + shared/ is stored in
 * .extras-hash; decks whose hash is unchanged are skipped, so cached
 * artifacts are reused unless the deck or the shared engine changed.
 * Before printing, live iframes are visited in the interactive deck and their
 * painted surfaces are substituted into the print view. A labelled static
 * placeholder is used when a remote page cannot be captured. Pass
 * --no-frame-snapshots to disable this or --frame-timeout-ms N to tune it.
 * --force regenerates everything; --decks a,b restricts the set.
 */
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeDigest } from './lib/export-cache.mjs';
import { exportDeck, exportLandingCard } from './lib/export-deck.mjs';
import { intArg, launchChromium, listDecks, startStaticServer, valueArg } from './lib/runtime.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function main(args = process.argv.slice(2)) {
  const root = resolve(valueArg(args, '--root', REPO));
  const only = valueArg(args, '--decks', null)?.split(',');
  const frameTimeoutMs = intArg(args, '--frame-timeout-ms', 12000);
  // Validate selection before allocating a server or starting a browser.
  const decks = listDecks(root, { includeDrafts: false, only });
  const sharedDigest = treeDigest(join(root, 'shared'));
  const { chromium } = await import('playwright');
  let site, browser, failures = 0;
  try {
    site = await startStaticServer(root);
    browser = await launchChromium(chromium, {
      executablePath: valueArg(args, '--executable-path', null),
      channel: valueArg(args, '--browser-channel', null),
    });
    console.log(`info  browser: Chromium ${browser.version()}`);
    for (const slug of decks) {
      try {
        await exportDeck({ browser, root, repo: REPO, base: site.base, slug, sharedDigest,
          force: args.includes('--force'), refreshFrames: args.includes('--refresh-frames'),
          frameSnapshots: !args.includes('--no-frame-snapshots'), frameTimeoutMs });
      } catch (error) {
        failures += 1;
        console.error(`FAIL  ${slug}: ${error.message}`);
      }
    }
    if (!only) {
      try {
        await exportLandingCard({ browser, root, base: site.base });
        console.log('ok    landing page: social-card.png');
      } catch (error) {
        failures += 1;
        console.error(`FAIL  landing page: ${error.message}`);
      }
    }
  } finally {
    try { await browser?.close(); } finally { await site?.close(); }
  }
  console.log(failures ? `\nexport-pdf: ${failures} failure(s)` : '\nexport-pdf: done');
  return failures ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(`export-pdf: ${error.message}`);
    process.exitCode = 1;
  });
}
