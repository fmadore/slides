import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export const EXTRAS_CACHE_VERSION = '2';
const GENERATED = new Set(['slides.pdf', 'social-card.png', '.extras-hash']);

export function hashTree(dir, hash, base = dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      hashTree(path, hash, base);
    } else if (!GENERATED.has(entry.name)) {
      hash.update(relative(base, path).replaceAll('\\', '/'));
      hash.update('\0');
      hash.update(readFileSync(path));
      hash.update('\0');
    }
  }
}

export function treeDigest(dir) {
  const hash = createHash('sha256');
  hashTree(dir, hash);
  return hash.digest('hex');
}

export function deckExtrasHash({ root, repo, slug, sharedDigest, dependencyFiles = [] }) {
  const hash = createHash('sha256');
  hash.update(`extras-cache-v${EXTRAS_CACHE_VERSION}\0`);
  hash.update(sharedDigest || treeDigest(join(root, 'shared')));
  hash.update('\0');
  hashTree(join(root, 'talks', slug), hash);
  for (const rel of dependencyFiles.sort()) {
    const path = join(repo, rel);
    hash.update(rel.replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(existsSync(path) ? readFileSync(path) : '<missing>');
    hash.update('\0');
  }
  return hash.digest('hex');
}
