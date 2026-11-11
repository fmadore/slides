import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { cellLabel, cellSize, paginate, parseArgs } from './contact-sheet.mjs';

// Importing the tool must not launch a browser: Playwright is loaded only in
// main(), so these tests run in CI before browsers are installed.

test('contact-sheet arguments default to every public deck at 1280×720, three columns', () => {
  const opts = parseArgs(['--out', 'sheets']);
  assert.equal(opts.out, resolve('sheets'));
  assert.equal(opts.decks, null);
  assert.deepEqual(opts.viewport, { width: 1280, height: 720 });
  assert.equal(opts.columns, 3);
  assert.equal(opts.full, false);
  assert.equal(opts.live, false);
});

test('contact-sheet arguments parse decks, flags, viewport and columns', () => {
  const opts = parseArgs(['--decks', '_template, _template-zmo', '--full', '--live', '--viewport', '390x844', '--columns', '4', '--out', 'x']);
  assert.deepEqual(opts.decks, ['_template', '_template-zmo']);
  assert.equal(opts.full, true);
  assert.equal(opts.live, true);
  assert.deepEqual(opts.viewport, { width: 390, height: 844 });
  assert.equal(opts.columns, 4);
  assert.equal(parseArgs(['--help']).help, true);
});

test('contact-sheet arguments reject missing or malformed values', () => {
  assert.throws(() => parseArgs([]), /--out DIR is required/);
  assert.throws(() => parseArgs(['--out']), /requires a value/);
  assert.throws(() => parseArgs(['--out', 'x', '--decks', 'a,,b']), /empty slug/);
  assert.throws(() => parseArgs(['--out', 'x', '--viewport', '1280*720']), /WIDTHxHEIGHT/);
  assert.throws(() => parseArgs(['--out', 'x', '--columns', '0']), /positive integer/);
  assert.throws(() => parseArgs(['--out', 'x', '--columns', '11']), /10 or fewer/);
  assert.throws(() => parseArgs(['--out', 'x', '--fulll']), /unknown argument: --fulll/);
});

test('slides paginate into full sheets with a shorter last one', () => {
  assert.deepEqual(paginate(0, 9), []);
  assert.deepEqual(paginate(9, 9), [{ sheet: 1, start: 0, end: 9 }]);
  assert.deepEqual(paginate(28, 9).map(p => [p.sheet, p.start, p.end]), [[1, 0, 9], [2, 9, 18], [3, 18, 27], [4, 27, 28]]);
  assert.throws(() => paginate(3, 0), /positive integer/);
});

test('cells keep the slide aspect and labels carry annexe folio and fit scale', () => {
  assert.deepEqual(cellSize({ width: 1280, height: 720 }), { width: 640, height: 360 });
  assert.deepEqual(cellSize({ width: 390, height: 844 }), { width: 300, height: 649 });
  assert.equal(cellLabel({ n: 3, folio: '03', fit: null }), '3');
  assert.equal(cellLabel({ n: 27, folio: 'A01', fit: null }), '27 · A01');
  assert.equal(cellLabel({ n: 21, folio: '21', fit: '0.994' }), '21 · ×0.994');
});

test('contact-sheet exits 1 with usage on bad arguments, before any browser starts', () => {
  const tool = fileURLToPath(new URL('./contact-sheet.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [tool, '--decks', '_template'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--out DIR is required/);
  assert.match(result.stderr, /usage: node tools\/contact-sheet\.mjs/);
  const unknown = spawnSync(process.execPath, [tool, '--out', 'unused', '--decks', 'no-such-deck'], { encoding: 'utf8' });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unknown decks: no-such-deck/);
});
