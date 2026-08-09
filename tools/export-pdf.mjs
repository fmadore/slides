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
 * --force regenerates everything; --decks a,b restricts the set.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deckExtrasHash, treeDigest } from './lib/export-cache.mjs';
import { launchChromium, listDecks, startStaticServer, valueArg } from './lib/runtime.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ROOT = resolve(valueArg(args, '--root', REPO));
const FORCE = args.includes('--force');
const ONLY = valueArg(args, '--decks', null)?.split(',');
const EXECUTABLE_PATH = valueArg(args, '--executable-path', null);
const BROWSER_CHANNEL = valueArg(args, '--browser-channel', null);

const { chromium } = await import('playwright');

const staticSite = await startStaticServer(ROOT);
const BASE = staticSite.base;
const sharedDigest = treeDigest(join(ROOT, 'shared'));
const CACHE_DEPENDENCIES = [
  'package-lock.json',
  'tools/export-pdf.mjs',
  'tools/lib/export-cache.mjs',
  'tools/lib/runtime.mjs',
];

const decks = listDecks(ROOT, { includeDrafts: false, only: ONLY });
const browser = await launchChromium(chromium, {
  executablePath: EXECUTABLE_PATH,
  channel: BROWSER_CHANNEL,
});
let failures = 0;

for (const slug of decks) {
  const deckDir = join(ROOT, 'talks', slug);
  const hashFile = join(deckDir, '.extras-hash');
  const hash = deckExtrasHash({
    root: ROOT,
    repo: REPO,
    slug,
    sharedDigest,
    dependencyFiles: CACHE_DEPENDENCIES,
  });
  if (!FORCE && existsSync(hashFile) && readFileSync(hashFile, 'utf8') === hash &&
      existsSync(join(deckDir, 'slides.pdf')) && existsSync(join(deckDir, 'social-card.png'))) {
    console.log(`ok    ${slug}: unchanged — reusing cached slides.pdf + social-card.png`);
    continue;
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  // ---- PDF (?print-pdf → one page per slide, backgrounds on) --------------
  await page.goto(`${BASE}/talks/${slug}/?print-pdf`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts ? document.fonts.ready : null);
  await page.waitForSelector('.reveal .pdf-page', { timeout: 30000 });
  await page.waitForTimeout(1500); // lazy images inside pdf pages
  const slideCount = await page.evaluate(() => document.querySelectorAll('.reveal .pdf-page').length);
  const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  const pageCount = (pdf.toString('latin1').match(/\/Type[\s]*\/Page[^s]/g) || []).length;
  if (pageCount !== slideCount) {
    console.log(`FAIL  ${slug}: PDF has ${pageCount} pages for ${slideCount} slides`);
    failures++;
    await ctx.close();
    continue;
  }
  writeFileSync(join(deckDir, 'slides.pdf'), pdf);

  // ---- social card (cover screenshot) --------------------------------------
  await page.goto(`${BASE}/talks/${slug}/`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts ? document.fonts.ready : null);
  await page.waitForTimeout(1500); // let the cover's rules draw + webfonts paint
  await page.screenshot({ path: join(deckDir, 'social-card.png') });

  writeFileSync(hashFile, hash);
  console.log(`ok    ${slug}: slides.pdf (${slideCount} pages, ${(pdf.length / 1024 / 1024).toFixed(1)} MB) + social-card.png`);
  await ctx.close();
}

// ---- landing-page social card ---------------------------------------------
// Deliberately outside the .extras-hash cache: one screenshot costs a couple
// of seconds against minutes of PDF export, and leaving it uncached keeps the
// workflow's cache glob scoped to talks/, where the expensive artifacts live.
// Skipped under --decks, which asks for a restricted set.
if (!ONLY) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts ? document.fonts.ready : null);
  await page.waitForTimeout(1500); // let the masthead rules draw + webfonts paint
  await page.screenshot({ path: join(ROOT, 'social-card.png') });
  console.log('ok    landing page: social-card.png');
  await ctx.close();
}

await browser.close();
await staticSite.close();
console.log(failures ? `\nexport-pdf: ${failures} failure(s)` : '\nexport-pdf: done');
process.exit(failures ? 1 : 0);
