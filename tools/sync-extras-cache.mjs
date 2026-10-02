#!/usr/bin/env node
/** Copy generated outputs only for decks present in the current publication. */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { valueArg } from './lib/runtime.mjs';

const OUTPUTS = ['slides.pdf', 'social-card.png', '.extras-hash', 'export-evidence.json'];

function entry(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function inside(path, parent) {
  const rel = relative(parent, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}

function directory(path, create = false) {
  let info = entry(path);
  if (!info) {
    if (!create) return false;
    mkdirSync(path, { recursive: true });
    info = entry(path);
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error(`expected a real directory: ${path}`);
  }
  return true;
}

export function syncExtras({ root, cache, save = false }) {
  root = resolve(root);
  cache = resolve(cache);
  if (inside(root, cache) || inside(cache, root)) {
    throw new Error('publication and cache directories must be separate');
  }
  directory(root);
  directory(join(root, 'talks'));
  const slugs = readdirSync(join(root, 'talks'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => entry.name)
    .filter(slug => existsSync(join(root, 'talks', slug, 'index.html')));
  if (!directory(cache, save)) return 0;
  if (!directory(join(cache, 'talks'), save)) return 0;

  // Remove obsolete generated outputs, never whole restored directories or
  // arbitrary files. Even a malicious/stale cache cannot expand publication.
  if (save) {
    for (const entry of readdirSync(join(cache, 'talks'), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const folder = join(cache, 'talks', entry.name);
      directory(folder);
      for (const name of OUTPUTS) {
        const path = join(folder, name);
        if (existsSync(path) && lstatSync(path).isFile()) rmSync(path);
      }
    }
  }
  let copied = 0;
  for (const slug of slugs) {
    const source = join(save ? root : cache, 'talks', slug);
    const target = join(save ? cache : root, 'talks', slug);
    if (!directory(source)) continue;
    directory(target, true);
    for (const name of OUTPUTS) {
      const from = join(source, name), to = join(target, name);
      const sourceInfo = entry(from), targetInfo = entry(to);
      if (!sourceInfo) continue;
      if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) throw new Error(`unsafe cached output: ${from}`);
      if (targetInfo && (!targetInfo.isFile() || targetInfo.isSymbolicLink())) throw new Error(`unsafe output target: ${to}`);
      copyFileSync(from, to);
      copied++;
    }
  }
  return copied;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const root = valueArg(args, '--root'), cache = valueArg(args, '--cache');
  if (!root || !cache || args.includes('--save') === args.includes('--restore')) {
    throw new Error('usage: sync-extras-cache.mjs --root SITE --cache CACHE (--restore|--save)');
  }
  console.log(`extras cache: ${syncExtras({ root, cache, save: args.includes('--save') })} generated files copied`);
}
