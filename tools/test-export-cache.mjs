import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deckExtrasHash, treeDigest, reusableEvidence } from './lib/export-cache.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-cache-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'shared'), { recursive: true });
  await mkdir(path.join(root, 'talks', 'demo', 'assets'), { recursive: true });
  await mkdir(path.join(root, 'tools'), { recursive: true });
  await writeFile(path.join(root, 'shared', 'theme.css'), 'body{}');
  await writeFile(path.join(root, 'talks', 'demo', 'index.html'), '<html/>');
  await writeFile(path.join(root, 'talks', 'demo', 'assets', 'image.png'), 'image');
  await writeFile(path.join(root, 'tools', 'export-pdf.mjs'), 'export{}');
  return root;
}

test('tree digests include relative paths as well as bytes', async t => {
  const root = await fixture(t);
  const before = treeDigest(path.join(root, 'talks', 'demo'));
  await rename(
    path.join(root, 'talks', 'demo', 'assets', 'image.png'),
    path.join(root, 'talks', 'demo', 'assets', 'renamed.png'),
  );
  assert.notEqual(treeDigest(path.join(root, 'talks', 'demo')), before);
});

test('generated export artifacts do not invalidate the content digest', async t => {
  const root = await fixture(t);
  const deck = path.join(root, 'talks', 'demo');
  const before = treeDigest(deck);
  await writeFile(path.join(deck, 'slides.pdf'), 'generated');
  await writeFile(path.join(deck, 'social-card.png'), 'generated');
  await writeFile(path.join(deck, '.extras-hash'), 'generated');
  await writeFile(path.join(deck, 'export-evidence.json'), 'generated');
  assert.equal(treeDigest(deck), before);
});

test('rendering options invalidate cached output; temporary failures expire', async t => {
  const root = await fixture(t);
  const base = { root, repo: root, slug: 'demo' };
  assert.notEqual(deckExtrasHash({ ...base, options: { snapshots: true } }), deckExtrasHash({ ...base, options: { snapshots: false } }));
  const now = Date.now();
  const evidence = { version: 1, createdAt: new Date(now).toISOString(), frames: [{ captured: false }] };
  assert.equal(reusableEvidence(evidence, now), true);
  assert.equal(reusableEvidence(evidence, now + 3600001), false);
  assert.equal(reusableEvidence({ ...evidence, frames: [{ captured: true }] }, now + 3600001), true);
  assert.equal(reusableEvidence(null), false);
});

test('export cache hash changes with deck, shared, and tool dependencies', async t => {
  const root = await fixture(t);
  const options = {
    root,
    repo: root,
    slug: 'demo',
    sharedDigest: treeDigest(path.join(root, 'shared')),
    dependencyFiles: ['tools/export-pdf.mjs'],
  };
  const first = deckExtrasHash(options);
  await writeFile(path.join(root, 'tools', 'export-pdf.mjs'), 'changed');
  const toolChanged = deckExtrasHash(options);
  assert.notEqual(toolChanged, first);
  await writeFile(path.join(root, 'talks', 'demo', 'index.html'), '<html>changed</html>');
  assert.notEqual(deckExtrasHash(options), toolChanged);
  await writeFile(path.join(root, 'shared', 'theme.css'), 'changed');
  assert.notEqual(deckExtrasHash({ ...options, sharedDigest: undefined }), deckExtrasHash({ ...options, sharedDigest: 'fixed' }));
});
