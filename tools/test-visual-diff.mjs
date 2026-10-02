import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';

test('visual comparisons reject empty or incomplete baselines', t => {
  const root = mkdtempSync(join(tmpdir(), 'slides-visual-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const before = join(root, 'before'), after = join(root, 'after');
  mkdirSync(before); mkdirSync(after);
  const run = () => spawnSync(process.execPath, [fileURLToPath(new URL('./visual-diff.mjs', import.meta.url)), '--before', before, '--after', after], { encoding: 'utf8' });
  assert.equal(run().status, 1);
  const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
  writeFileSync(join(after, 'slide.png'), png);
  assert.equal(run().status, 1);
  writeFileSync(join(before, 'slide.png'), png);
  assert.equal(run().status, 0);
  writeFileSync(join(after, 'missing-baseline.png'), png);
  assert.equal(run().status, 1);
});

test('a visual approval is bound to the merge base and exact reviewed pixels', t => {
  const root = mkdtempSync(join(tmpdir(), 'slides-visual-review-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const before = join(root, 'before'), after = join(root, 'after'), out = join(root, 'diff');
  mkdirSync(before); mkdirSync(after);
  const a = new PNG({ width: 10, height: 10 }); a.data.fill(0);
  const b = new PNG({ width: 10, height: 10 }); b.data.fill(255);
  writeFileSync(join(before, 'slide.png'), PNG.sync.write(a));
  writeFileSync(join(after, 'slide.png'), PNG.sync.write(b));
  const path = join(root, 'approvals.json');
  const afterSha256 = createHash('sha256').update('10x10\0').update(b.data).digest('hex');
  const document = { version: 1, base: 'a'.repeat(40), snapshots: [{ name: 'slide.png', afterSha256, reason: 'Reviewed palette correction' }] };
  writeFileSync(path, JSON.stringify(document));
  const run = base => spawnSync(process.execPath, [fileURLToPath(new URL('./visual-diff.mjs', import.meta.url)), '--before', before, '--after', after, '--out', out, '--approvals', path, '--base', base], { encoding: 'utf8' });
  assert.equal(run(document.base).status, 0);
  assert.equal(run('b'.repeat(40)).status, 1);
  b.data.fill(127);
  writeFileSync(join(after, 'slide.png'), PNG.sync.write(b));
  assert.equal(run(document.base).status, 1, 'an additional unreviewed change must fail');
});
