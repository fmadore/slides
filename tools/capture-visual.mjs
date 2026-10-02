#!/usr/bin/env node
/** Capture comparable visual fixtures, including the public archive.
 * --root TREE --fixtures BASE_TREE --out DIR [--decks slug,...]
 * Both sides use the base catalogue's HTML/assets, even when a PR edits it.
 * Public pages/decks retain their actual content so authored changes are visible.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserDiagnostics } from './lib/browser-diagnostics.mjs';
import { settleAnimations } from './lib/a11y.mjs';
import { launchChromium, listDecks, startStaticServer, valueArg } from './lib/runtime.mjs';

const args = process.argv.slice(2);
const root = resolve(valueArg(args, '--root', resolve(dirname(fileURLToPath(import.meta.url)), '..')));
const fixtures = resolve(valueArg(args, '--fixtures', root));
const out = valueArg(args, '--out');
if (!out) throw new Error('usage: capture-visual.mjs --root TREE --fixtures BASE_TREE --out DIR');
const available = listDecks(fixtures, { includeDrafts: false });
const selected = valueArg(args, '--decks', null)?.split(',') || [...new Set([available[0], available[Math.floor(available.length / 2)], available.at(-1)].filter(Boolean))];
const stage = mkdtempSync(join(tmpdir(), 'slides-visual-'));
mkdirSync(join(stage, 'talks'));
cpSync(join(root, 'shared'), join(stage, 'shared'), { recursive: true });
for (const name of ['index.html', '404.html']) cpSync(join(root, name), join(stage, name));
const catalogue = existsSync(join(fixtures, 'talks/_showcase/index.html')) ? '_showcase' : '_template';
cpSync(join(fixtures, 'talks', catalogue), join(stage, 'talks', catalogue), { recursive: true });
for (const slug of selected) {
  // A removed talk is already represented by the archive change; preserve its
  // fixture for engine comparison instead of creating an incomplete baseline.
  const source = existsSync(join(root, 'talks', slug, 'index.html')) ? root : fixtures;
  cpSync(join(source, 'talks', slug), join(stage, 'talks', slug), { recursive: true });
}
mkdirSync(out, { recursive: true });
const diagnostics = browserDiagnostics(join(out, 'diagnostics'));
const site = await startStaticServer(stage, { noStore: true });
const { chromium } = await import('playwright');
let browser, context;
try {
  browser = await launchChromium(chromium, { executablePath: valueArg(args, '--executable-path', null) });
  for (const [width, height] of [[1280, 720], [390, 844]]) {
    context = await diagnostics.attach(await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' }), `visual-${width}`);
    await context.route('**/*', route => route.request().url().startsWith(site.base) ? route.continue() : route.abort());
    const page = await context.newPage();
    for (const [name, path] of [['index', '/'], ['404', '/404.html']]) {
      await page.goto(`${site.base}${path}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await settleAnimations(page);
      await page.screenshot({ path: join(out, `page-${name}-${width}x${height}.png`) });
    }
    for (const slug of [catalogue, ...selected]) {
      await page.goto(`${site.base}/talks/${slug}/`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.DeckRuntime?.ready && window.Reveal?.isReady());
      await page.evaluate(() => window.DeckRuntime.ready);
      const shots = await page.evaluate(isCatalogue => {
        const leaves = window.DeckRuntime.leafSlides();
        const point = (slide, name) => ({ name, ...Reveal.getIndices(slide) });
        if (isCatalogue) return leaves.filter(slide => slide.dataset.visualTest).map(slide => point(slide, slide.dataset.visualTest));
        return [point(leaves[0], 'cover'), point(leaves[Math.floor(leaves.length / 2)], 'content'), point(leaves.at(-1), 'closing')];
      }, slug === catalogue);
      if (!shots.length) throw new Error(`${slug}: no visual fixtures selected`);
      for (const shot of shots) {
        await page.evaluate(async ({ h, v }) => {
          Reveal.slide(h, v || 0);
          await window.DeckRuntime.settle();
          while (Reveal.nextFragment()) { /* final authored state */ }
        }, shot);
        await settleAnimations(page);
        const label = slug === catalogue ? 'catalogue' : `deck-${slug}`;
        await page.screenshot({ path: join(out, `${label}-${shot.name}-${width}x${height}.png`) });
      }
    }
    await context.close();
    context = null;
  }
  console.log(`visual capture: ${selected.length} public decks, archive, 404 and stable catalogue → ${out}`);
} catch (error) {
  diagnostics.capture('visual capture', error.stack || String(error));
  process.exitCode = 1;
  console.error(error);
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  await site.close();
  rmSync(stage, { recursive: true, force: true });
}
