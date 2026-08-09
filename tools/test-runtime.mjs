import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  intArg,
  listDecks,
  mapLimit,
  resolveServedPath,
  startStaticServer,
  valueArg,
} from './lib/runtime.mjs';

test('argument helpers validate missing and invalid values', () => {
  assert.equal(valueArg(['--root', 'site'], '--root'), 'site');
  assert.equal(valueArg([], '--root', 'repo'), 'repo');
  assert.throws(() => valueArg(['--root'], '--root'), /requires a value/);
  assert.equal(intArg(['--concurrency', '3'], '--concurrency', 1), 3);
  assert.throws(() => intArg(['--concurrency', '0'], '--concurrency', 1), /positive integer/);
});

test('served paths stay inside the configured root', () => {
  const root = path.resolve('fixture-root');
  assert.equal(resolveServedPath(root, '/'), path.join(root, 'index.html'));
  assert.equal(resolveServedPath(root, '/talks/demo/index.html'), path.join(root, 'talks', 'demo', 'index.html'));
  assert.equal(resolveServedPath(root, '/../secret'), null);
  assert.equal(resolveServedPath(root, '/%2e%2e/secret'), null);
  assert.equal(resolveServedPath(root, '/%E0%A4%A'), null);
});

test('deck discovery is sorted, filterable, and ignores folders without an index', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const deck of ['2026-b', '2026-a', '_template']) {
    await mkdir(path.join(root, 'talks', deck), { recursive: true });
    await writeFile(path.join(root, 'talks', deck, 'index.html'), deck);
  }
  await mkdir(path.join(root, 'talks', 'empty'));
  assert.deepEqual(listDecks(root), ['2026-a', '2026-b', '_template']);
  assert.deepEqual(listDecks(root, { includeDrafts: false }), ['2026-a', '2026-b']);
  assert.deepEqual(listDecks(root, { only: ['2026-b'] }), ['2026-b']);
});

test('static server returns files, MIME headers, cache policy, and safe 404s', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-server-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<h1>slides</h1>');
  const site = await startStaticServer(root, { noStore: true });
  t.after(() => site.close());
  const ok = await fetch(`${site.base}/`);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type'), /^text\/html/);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal(await ok.text(), '<h1>slides</h1>');
  assert.equal((await fetch(`${site.base}/missing`)).status, 404);
  assert.equal((await fetch(`${site.base}/%2e%2e/secret`)).status, 404);
});

test('mapLimit processes every value and respects its concurrency limit', async () => {
  let active = 0;
  let peak = 0;
  const seen = [];
  await mapLimit([1, 2, 3, 4, 5], 2, async value => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    seen.push(value);
    active -= 1;
  });
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5]);
  assert.equal(peak, 2);
});
