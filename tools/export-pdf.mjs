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
 * Incremental: a content hash of the deck folder + shared/ is stored in
 * .extras-hash; decks whose hash is unchanged are skipped, so cached
 * artifacts are reused unless the deck or the shared engine changed.
 * --force regenerates everything; --decks a,b restricts the set.
 */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
}
const ROOT = resolve(opt('--root', REPO));
const FORCE = args.includes('--force');
const ONLY = opt('--decks', null)?.split(',');

const { chromium } = await import('playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.md': 'text/markdown',
};
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

function hashTree(dir, h) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) hashTree(p, h);
    else if (!['slides.pdf', 'social-card.png', '.extras-hash', 'offline.zip'].includes(e.name)) {
      h.update(e.name); h.update(readFileSync(p));
    }
  }
}
function deckHash(slug) {
  const h = createHash('sha256');
  hashTree(join(ROOT, 'talks', slug), h);
  hashTree(join(ROOT, 'shared'), h);
  return h.digest('hex');
}

let decks = readdirSync(join(ROOT, 'talks'), { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_') &&
               existsSync(join(ROOT, 'talks', d.name, 'index.html')))
  .map(d => d.name);
if (ONLY) decks = decks.filter(d => ONLY.includes(d));

async function launch() {
  try { return await chromium.launch(); }
  catch {
    const p = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    if (existsSync(p)) return chromium.launch({ executablePath: p });
    throw new Error('no chromium found — run: npx playwright install chromium');
  }
}
const browser = await launch();
let failures = 0;

for (const slug of decks) {
  const deckDir = join(ROOT, 'talks', slug);
  const hashFile = join(deckDir, '.extras-hash');
  const hash = deckHash(slug);
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

await browser.close();
server.close();
console.log(failures ? `\nexport-pdf: ${failures} failure(s)` : '\nexport-pdf: done');
process.exit(failures ? 1 : 0);
