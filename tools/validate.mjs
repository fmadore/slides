#!/usr/bin/env node
/* One command for the validation CI runs before every deploy.
 *
 *   npm run validate                 static checks, unit tests, publication build
 *   npm run validate -- --browser    … plus the Playwright browser checks
 *
 * The steps run in CI's order, and every step runs even after one fails, so a
 * single pass reports everything wrong at once; the exit status is 1 if any
 * step failed. Arguments after --browser are handed to browser-check.mjs
 * (e.g. `-- --browser --decks _showcase`).
 *
 * Half of the tooling is Python, and the interpreter's name differs by
 * platform: python3 on macOS and Linux, the py launcher or python on Windows.
 * The first candidate that answers `--version` with Python 3 is used;
 * SLIDES_PYTHON overrides the search (e.g. SLIDES_PYTHON="py -3.12").
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Interpreter candidates, most specific first, as [command, ...args]. */
export function pythonCandidates(env = process.env, platform = process.platform) {
  if (env.SLIDES_PYTHON && env.SLIDES_PYTHON.trim()) return [env.SLIDES_PYTHON.trim().split(/\s+/)];
  return platform === 'win32'
    ? [['py', '-3'], ['python'], ['python3']]
    : [['python3'], ['python']];
}

/** The first candidate that runs and reports Python 3, or null. `probe`
 *  takes a candidate and returns its `--version` output (or null). */
export function findPython(candidates, probe) {
  for (const candidate of candidates) {
    const output = probe(candidate);
    if (output && /^Python 3\./m.test(output.trim())) return candidate;
  }
  return null;
}

function probeVersion([command, ...args]) {
  const result = spawnSync(command, [...args, '--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function run(name, command, args) {
  console.log(`\n▸ ${name}`);
  const started = Date.now();
  const result = spawnSync(command, args, { cwd: REPO, stdio: 'inherit' });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const ok = !result.error && result.status === 0;
  if (result.error) console.log(`  could not start ${command}: ${result.error.message}`);
  return { name, ok, seconds };
}

function main(argv) {
  const browserAt = argv.indexOf('--browser');
  const browserArgs = browserAt >= 0 ? argv.slice(browserAt + 1) : null;
  const node = process.execPath;
  const python = findPython(pythonCandidates(), probeVersion);
  const steps = [];

  steps.push(run('shared bundles are current', node, ['tools/build-shared.mjs', '--check']));
  // Node expands the glob itself, so this needs no shell on any platform.
  steps.push(run('Node unit tests', node, ['--test', 'tools/test-*.mjs']));

  if (!python) {
    console.log('\n▸ Python steps skipped: no Python 3 found (tried ' +
      pythonCandidates().map(c => c.join(' ')).join(', ') + '; set SLIDES_PYTHON)');
    steps.push({ name: 'Python 3 available', ok: false, seconds: '0.0' });
  } else {
    const [py, ...pyArgs] = python;
    steps.push(run('Python unit tests', py, [...pyArgs, '-m', 'unittest', 'discover', '-s', 'tools', '-p', 'test_*.py']));
    steps.push(run('landing page, sitemap and deck metadata in sync', py, [...pyArgs, 'tools/build-index.py', '--check']));
    steps.push(run('repository audit (strict)', py, [...pyArgs, 'tools/audit.py', '--strict']));
    // The publication build must go to a directory that does not exist yet:
    // strip-notes.py refuses to replace one it did not create.
    const scratch = mkdtempSync(join(tmpdir(), 'slides-validate-'));
    const site = join(scratch, 'site');
    try {
      const built = run('notes-free publication build', py, [...pyArgs, 'tools/strip-notes.py', site]);
      steps.push(built);
      if (built.ok) {
        steps.push(run('publication build audit (strict)', py, [...pyArgs, 'tools/audit.py', '--site', site, '--strict']));
        if (browserArgs) steps.push(run('published-site browser smoke', node,
          ['tools/browser-smoke.mjs', '--root', site, '--publication']));
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }

  if (browserArgs) {
    steps.push(run('export browser regressions', node, ['tools/browser-export-regression.mjs']));
    steps.push(run('browser checks', node, ['tools/browser-check.mjs', ...browserArgs]));
  }

  const failed = steps.filter(step => !step.ok);
  console.log('\nvalidate:');
  for (const step of steps) console.log(`  ${step.ok ? 'ok  ' : 'FAIL'}  ${step.name} (${step.seconds}s)`);
  if (!browserArgs) console.log('  —     browser checks not run (add -- --browser)');
  console.log(failed.length ? `\n${failed.length} step(s) failed` : '\nall steps passed');
  return failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
