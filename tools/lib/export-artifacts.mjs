import * as filesystem from 'node:fs';
import { basename, join } from 'node:path';

/** Publish a complete artifact set only after every output is ready.
 * Individual renames are atomic; a failed replacement restores the old set.
 * Keep recovery files if a filesystem lock also prevents rollback.
 */
export function publishArtifacts(directory, artifacts, { fs = filesystem } = {}) {
  const names = Object.keys(artifacts);
  if (names.some(name => !name || basename(name) !== name || name === '.' || name === '..')) {
    throw new Error('artifact names must be simple filenames');
  }
  const stage = fs.mkdtempSync(join(directory, '.export-stage-'));
  const changes = [];
  let keepRecovery = false;
  try {
    for (const [name, bytes] of Object.entries(artifacts)) fs.writeFileSync(join(stage, name), bytes);
    fs.mkdirSync(join(stage, 'previous'));
    for (const name of names) {
      const change = { target: join(directory, name), backup: join(stage, 'previous', name), backedUp: false, installed: false };
      changes.push(change);
      if (fs.existsSync(change.target)) {
        fs.renameSync(change.target, change.backup);
        change.backedUp = true;
      }
      fs.renameSync(join(stage, name), change.target);
      change.installed = true;
    }
  } catch (error) {
    const recoveryErrors = [];
    for (const change of changes.reverse()) {
      try {
        if (change.installed) fs.rmSync(change.target, { force: true });
        if (change.backedUp) fs.renameSync(change.backup, change.target);
      } catch (recoveryError) { recoveryErrors.push(recoveryError); }
    }
    if (recoveryErrors.length) {
      keepRecovery = true;
      throw new AggregateError([error, ...recoveryErrors], `artifact rollback incomplete; previous files retained in ${stage}`);
    }
    throw error;
  } finally {
    if (!keepRecovery) fs.rmSync(stage, { recursive: true, force: true });
  }
}
