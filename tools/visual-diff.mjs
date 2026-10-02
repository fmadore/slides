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
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { valueArg } from './lib/runtime.mjs';

const args = process.argv.slice(2);
const BEFORE = valueArg(args, '--before');
const AFTER = valueArg(args, '--after');
const OUT = valueArg(args, '--out', 'visual-diff');
const MAX_PCT = parseFloat(valueArg(args, '--max-diff-pct', '1.0'));
const THRESHOLD = parseFloat(valueArg(args, '--threshold', '0.12'));
const APPROVALS = valueArg(args, '--approvals', null);
const BASE = valueArg(args, '--base', null);
let approved = {};
if (APPROVALS && existsSync(APPROVALS)) {
  const document = JSON.parse(readFileSync(APPROVALS, 'utf8'));
  if (document.version !== 1 || !Array.isArray(document.snapshots)) throw new Error('invalid visual approval document');
  if (BASE && document.base === BASE) {
    for (const item of document.snapshots) {
      if (!item.name || !/^[a-f0-9]{64}$/.test(item.afterSha256 || '') || !item.reason?.trim()) throw new Error('visual approval needs name, pixel SHA256 and review reason');
      if (approved[item.name]) throw new Error(`duplicate visual approval: ${item.name}`);
      approved[item.name] = item;
    }
  } else if (document.snapshots.length) console.log('visual approvals are for a different merge base; none apply');
}
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
const results = [];
const matched = [...before].filter(name => after.has(name));
if (!matched.length) {
  console.error('FAIL  no matching baseline screenshots; comparison is incomplete');
  process.exit(1);
}

for (const name of [...before].filter(n => !after.has(n))) {
  console.log(`FAIL  ${name}: present in --before but missing from --after`);
  failures++;
}
for (const name of [...after].filter(n => !before.has(n))) {
  console.log(`FAIL  ${name}: no baseline screenshot — capture or approve a complete baseline`);
  failures++;
}

for (const name of matched) {
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
  const afterSha256 = createHash('sha256').update(`${b.width}x${b.height}\0`).update(b.data).digest('hex');
  const review = approved[name]?.afterSha256 === afterSha256 ? approved[name] : null;
  results.push({ name, percent: pct, afterSha256, reviewed: Boolean(review), reason: review?.reason });
  if (pct > MAX_PCT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, name.replace(/\.png$/, '.diff.png')), PNG.sync.write(diff));
    if (review) console.log(`REVIEWED  ${name}: ${pct.toFixed(2)}% differ — ${review.reason}`);
    else {
      console.log(`FAIL  ${name}: ${pct.toFixed(2)}% of pixels differ (limit ${MAX_PCT}%)`);
      failures++;
    }
  } else {
    console.log(`ok    ${name}: ${pct.toFixed(2)}% differ`);
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ base: BASE, failures, results }, null, 2) + '\n');

console.log(failures ? `\nvisual-diff: ${failures} failure(s) — diffs in ${OUT}/`
                     : '\nvisual-diff: no regressions');
process.exit(failures ? 1 : 0);
