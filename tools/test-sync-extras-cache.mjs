import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { syncExtras } from './sync-extras-cache.mjs';

test('restoration cannot republish removed decks or arbitrary cached files', t => {
  const folder = mkdtempSync(join(tmpdir(), 'slides-cache-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const root = join(folder, 'site'), cache = join(folder, 'cache');
  for (const [base, slug] of [[root, 'current'], [cache, 'current'], [cache, 'removed']]) mkdirSync(join(base, 'talks', slug), { recursive: true });
  writeFileSync(join(root, 'talks/current/index.html'), 'current');
  writeFileSync(join(cache, 'talks/current/slides.pdf'), 'pdf');
  writeFileSync(join(cache, 'talks/current/private.txt'), 'never copy');
  writeFileSync(join(cache, 'talks/removed/slides.pdf'), 'old');
  assert.equal(syncExtras({ root, cache }), 1);
  assert.equal(readFileSync(join(root, 'talks/current/slides.pdf'), 'utf8'), 'pdf');
  assert.equal(existsSync(join(root, 'talks/current/private.txt')), false);
  assert.equal(existsSync(join(root, 'talks/removed')), false);
  syncExtras({ root, cache, save: true });
  assert.equal(existsSync(join(cache, 'talks/removed/slides.pdf')), false);
  assert.equal(readFileSync(join(cache, 'talks/current/private.txt'), 'utf8'), 'never copy');
});

test('cache output symlinks are rejected', t => {
  const folder = mkdtempSync(join(tmpdir(), 'slides-cache-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const root = join(folder, 'site'), cache = join(folder, 'cache');
  for (const base of [root, cache]) mkdirSync(join(base, 'talks/current'), { recursive: true });
  writeFileSync(join(root, 'talks/current/index.html'), 'current');
  writeFileSync(join(folder, 'secret'), 'secret');
  symlinkSync(join(folder, 'secret'), join(cache, 'talks/current/slides.pdf'));
  assert.throws(() => syncExtras({ root, cache }), /unsafe cached output/);
});

test('saving never follows a dangling destination symlink outside the cache', t => {
  const folder = mkdtempSync(join(tmpdir(), 'slides-cache-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const root = join(folder, 'site'), cache = join(folder, 'cache');
  for (const base of [root, cache]) mkdirSync(join(base, 'talks/current'), { recursive: true });
  writeFileSync(join(root, 'talks/current/index.html'), 'current');
  writeFileSync(join(root, 'talks/current/slides.pdf'), 'pdf');
  const outside = join(folder, 'outside.pdf');
  symlinkSync(outside, join(cache, 'talks/current/slides.pdf'));
  assert.throws(() => syncExtras({ root, cache, save: true }), /unsafe output target/);
  assert.equal(existsSync(outside), false);
  assert.throws(() => syncExtras({ root, cache: join(root, 'nested') }), /must be separate/);
});
