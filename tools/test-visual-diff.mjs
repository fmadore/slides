import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PNG } from 'pngjs';

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
