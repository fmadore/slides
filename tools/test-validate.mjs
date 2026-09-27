import assert from 'node:assert/strict';
import test from 'node:test';
import { findPython, pythonCandidates } from './validate.mjs';

test('interpreter candidates follow the platform, and SLIDES_PYTHON overrides them', () => {
  assert.deepEqual(pythonCandidates({}, 'linux'), [['python3'], ['python']]);
  assert.deepEqual(pythonCandidates({}, 'darwin'), [['python3'], ['python']]);
  assert.deepEqual(pythonCandidates({}, 'win32'), [['py', '-3'], ['python'], ['python3']]);
  assert.deepEqual(pythonCandidates({ SLIDES_PYTHON: ' py -3.12 ' }, 'win32'), [['py', '-3.12']]);
  assert.deepEqual(pythonCandidates({ SLIDES_PYTHON: '  ' }, 'linux'), [['python3'], ['python']]);
});

test('the first candidate reporting Python 3 wins; Python 2 and missing commands do not', () => {
  const answers = new Map([
    ['python3', null],                    // not installed
    ['python', 'Python 2.7.18\n'],        // the wrong major version
    ['py -3', 'Python 3.12.4\n'],
  ]);
  const probe = candidate => answers.get(candidate.join(' ')) ?? null;
  assert.deepEqual(findPython([['python3'], ['python'], ['py', '-3']], probe), ['py', '-3']);
  assert.equal(findPython([['python3'], ['python']], probe), null);
});
