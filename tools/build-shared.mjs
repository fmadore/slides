#!/usr/bin/env node
/** Build the stable public shared bundles from reviewable source partials. */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const bundles = [
  {
    output: 'shared/theme.css',
    sources: [
      'shared/src/theme/01-foundations.css',
      'shared/src/theme/02-components.css',
      'shared/src/theme/03-layouts.css',
      'shared/src/theme/04-chrome.css',
      'shared/src/theme/05-embeds-code.css',
      'shared/src/theme/06-responsive-print.css',
      'shared/src/theme/07-data-viz.css',
      'shared/src/theme/08-image-editorial.css',
      'shared/src/theme/09-flow-motion.css',
    ],
  },
  {
    output: 'shared/deck.js',
    sources: [
      'shared/src/deck/01-foundation.js',
      'shared/src/deck/02-chrome.js',
      'shared/src/deck/03-toc-sync.js',
      'shared/src/deck/04-fit-effects.js',
      'shared/src/deck/05-boot-embeds.js',
      'shared/src/deck/06-lightbox.js',
      'shared/src/deck/07-iframes-highlight.js',
      'shared/src/deck/08-diagnostics.js',
    ],
  },
];

let stale = false;
for (const bundle of bundles) {
  const chunks = await Promise.all(bundle.sources.map(async source => {
    const value = await readFile(path.join(root, source), 'utf8');
    if (!value) throw new Error(`${source} is empty`);
    if (!value.endsWith('\n')) throw new Error(`${source} must end with a newline`);
    return value;
  }));
  const generated = chunks.join('\n');
  const output = path.join(root, bundle.output);
  if (check) {
    const current = await readFile(output, 'utf8').catch(() => '');
    if (current !== generated) {
      console.error(`stale  ${bundle.output} — run npm run build:shared`);
      stale = true;
    } else {
      console.log(`ok     ${bundle.output}`);
    }
    continue;
  }
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, generated, 'utf8');
  await rename(temporary, output);
  console.log(`built  ${bundle.output} from ${bundle.sources.length} source partials`);
}

if (stale) process.exitCode = 1;
