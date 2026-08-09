#!/usr/bin/env node
/* Lightweight visual regression: compare two directories of screenshots
 * (produced by `node tools/browser-check.mjs --screenshots DIR`, typically one
 * run from the merge-base and one from the head of a change to theme.css,
 * deck.js or the vendored reveal.js).
 *
 * Tolerances are deliberately loose — minor font-rendering differences must
 * not fail the build. A pair fails only when more than --max-diff-pct of
 * pixels differ (default 1%). Diff images for failing pairs are written to
 * --out so CI can upload them as workflow artifacts; nothing is committed.
 *
 * Usage:
 *   node tools/visual-diff.mjs --before DIR --after DIR [--out DIR]
 *                              [--max-diff-pct 1.0] [--threshold 0.12]
 *
 * Requires the pinned development dependencies (`npm ci`).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { valueArg } from './lib/runtime.mjs';

const args = process.argv.slice(2);
const BEFORE = valueArg(args, '--before');
const AFTER = valueArg(args, '--after');
const OUT = valueArg(args, '--out', 'visual-diff');
const MAX_PCT = parseFloat(valueArg(args, '--max-diff-pct', '1.0'));
const THRESHOLD = parseFloat(valueArg(args, '--threshold', '0.12'));
if (!BEFORE || !AFTER) {
  console.error('usage: node tools/visual-diff.mjs --before DIR --after DIR [--out DIR]');
  process.exit(2);
}

let PNG, pixelmatch;
try {
  ({ PNG } = await import('pngjs'));
  pixelmatch = (await import('pixelmatch')).default;
} catch {
  console.error('missing dependencies — run: npm ci');
  process.exit(2);
}

const before = new Set(readdirSync(BEFORE).filter(f => f.endsWith('.png')));
const after = new Set(readdirSync(AFTER).filter(f => f.endsWith('.png')));
let failures = 0;

for (const name of [...before].filter(n => !after.has(n))) {
  console.log(`FAIL  ${name}: present in --before but missing from --after`);
  failures++;
}
for (const name of [...after].filter(n => !before.has(n))) {
  console.log(`note  ${name}: new screenshot (no baseline) — skipped`);
}

for (const name of [...before].filter(n => after.has(n))) {
  const a = PNG.sync.read(readFileSync(join(BEFORE, name)));
  const b = PNG.sync.read(readFileSync(join(AFTER, name)));
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`FAIL  ${name}: size changed ${a.width}×${a.height} → ${b.width}×${b.height}`);
    failures++;
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: THRESHOLD });
  const pct = (100 * n) / (a.width * a.height);
  if (pct > MAX_PCT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, name.replace(/\.png$/, '.diff.png')), PNG.sync.write(diff));
    console.log(`FAIL  ${name}: ${pct.toFixed(2)}% of pixels differ (limit ${MAX_PCT}%)`);
    failures++;
  } else {
    console.log(`ok    ${name}: ${pct.toFixed(2)}% differ`);
  }
}

console.log(failures ? `\nvisual-diff: ${failures} failure(s) — diffs in ${OUT}/`
                     : '\nvisual-diff: no regressions');
process.exit(failures ? 1 : 0);
