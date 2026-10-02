import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import test from 'node:test';
import { publishArtifacts } from './lib/export-artifacts.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(join(tmpdir(), 'slides-artifacts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(join(root, 'slides.pdf'), 'old PDF');
  fs.writeFileSync(join(root, '.extras-hash'), 'old hash');
  return root;
}

test('artifact publication replaces the complete set and removes staging', t => {
  const root = fixture(t);
  publishArtifacts(root, { 'slides.pdf': 'new PDF', 'social-card.png': 'new card', '.extras-hash': 'new hash' });
  assert.equal(fs.readFileSync(join(root, 'slides.pdf'), 'utf8'), 'new PDF');
  assert.equal(fs.readFileSync(join(root, '.extras-hash'), 'utf8'), 'new hash');
  assert.deepEqual(fs.readdirSync(root).sort(), ['.extras-hash', 'slides.pdf', 'social-card.png']);
});

test('a failed replacement restores old artifacts and removes newly created ones', t => {
  const root = fixture(t);
  const injected = { ...fs, renameSync(source, target) {
    if (source.endsWith('social-card.png')) throw new Error('simulated disk failure');
    fs.renameSync(source, target);
  } };
  assert.throws(() => publishArtifacts(root, { 'slides.pdf': 'new PDF', 'social-card.png': 'new card', '.extras-hash': 'new hash' }, { fs: injected }), /disk failure/);
  assert.equal(fs.readFileSync(join(root, 'slides.pdf'), 'utf8'), 'old PDF');
  assert.equal(fs.readFileSync(join(root, '.extras-hash'), 'utf8'), 'old hash');
  assert.deepEqual(fs.readdirSync(root).sort(), ['.extras-hash', 'slides.pdf']);
});

test('rollback failure retains recovery files rather than deleting the old PDF', t => {
  const root = fixture(t);
  const injected = { ...fs, renameSync(source, target) {
    if (source.endsWith('social-card.png') || source.includes(`${sep}previous${sep}`)) throw new Error('simulated lock');
    fs.renameSync(source, target);
  } };
  assert.throws(() => publishArtifacts(root, { 'slides.pdf': 'new PDF', 'social-card.png': 'new card' }, { fs: injected }), /rollback incomplete/);
  const recovery = fs.readdirSync(root).find(name => name.startsWith('.export-stage-'));
  assert.equal(fs.readFileSync(join(root, recovery, 'previous/slides.pdf'), 'utf8'), 'old PDF');
});

test('artifact filenames cannot escape the publication directory', t => {
  const root = fixture(t);
  assert.throws(() => publishArtifacts(root, { '../other.pdf': 'bytes' }), /simple filenames/);
});
