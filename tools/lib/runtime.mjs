import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
};

export function valueArg(args, name, dflt = undefined) {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return args[i + 1];
}

export function intArg(args, name, dflt) {
  const raw = valueArg(args, name, String(dflt));
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

export function resolveServedPath(root, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const clean = decoded.replace(/^[\\/]+/, '');
  const file = resolve(root, clean || 'index.html');
  const rel = relative(root, file);
  if (!rel || rel === '.') return resolve(root, 'index.html');
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return file;
}

export async function startStaticServer(root, { noStore = false } = {}) {
  root = resolve(root);
  const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://local.invalid').pathname;
    const withIndex = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const file = resolveServedPath(root, withIndex);
    if (!file || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    const headers = { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' };
    if (noStore) headers['cache-control'] = 'no-store';
    res.writeHead(200, headers);
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  return {
    server,
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose())),
  };
}

export function listDecks(root, { includeDrafts = true, only = null } = {}) {
  const talks = join(root, 'talks');
  let decks = readdirSync(talks, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => includeDrafts || !entry.name.startsWith('_'))
    .filter(entry => existsSync(join(talks, entry.name, 'index.html')))
    .map(entry => entry.name)
    .sort();
  if (only) {
    const wanted = new Set(Array.isArray(only) ? only : String(only).split(','));
    decks = decks.filter(deck => wanted.has(deck));
  }
  return decks;
}

function systemBrowserCandidates() {
  if (process.platform === 'win32') {
    return [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ];
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

export async function launchChromium(chromium, { executablePath, channel } = {}) {
  const requested = executablePath || process.env.SLIDES_CHROMIUM_PATH;
  if (requested) {
    if (!existsSync(requested)) throw new Error(`Chromium executable not found: ${requested}`);
    return chromium.launch({ executablePath: requested });
  }
  if (channel) return chromium.launch({ channel });
  try {
    return await chromium.launch();
  } catch (firstError) {
    for (const candidate of systemBrowserCandidates()) {
      if (!existsSync(candidate)) continue;
      try {
        return await chromium.launch({ executablePath: candidate });
      } catch {
        // Try the next installed browser before reporting the original failure.
      }
    }
    throw new Error(
      'no Chromium found — run `npx playwright install chromium`, pass --executable-path, ' +
      'or set SLIDES_CHROMIUM_PATH',
      { cause: firstError },
    );
  }
}

export async function mapLimit(values, limit, worker) {
  const queue = [...values];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const value = queue.shift();
      await worker(value);
    }
  });
  await Promise.all(runners);
}
