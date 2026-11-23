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
  const value = Number(raw);
  if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
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
    const wanted = new Set((Array.isArray(only) ? only : String(only).split(',')).map(name => name.trim()));
    const unknown = [...wanted].filter(name => !decks.includes(name));
    if (unknown.length) throw new Error(`unknown decks: ${unknown.map(name => name || '(empty)').join(', ')}`);
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

// A request cancelled because the page moved on: the next goto aborts a frame
// or a lazy load that was still in flight. Chromium reports net::ERR_ABORTED;
// Firefox reports NS_BINDING_ABORTED (or no code at all once headers had
// arrived) and WebKit "cancelled". A request that already received a
// successful response is not a missing resource either: HTTP errors are
// caught separately from the response status.
const CANCELLED = /^(net::ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled)$/i;
export async function isCancelledRequest(request) {
  if (CANCELLED.test(request.failure()?.errorText || '')) return true;
  const response = await request.response().catch(() => null);
  return Boolean(response && response.status() < 400);
}

// True when a console message is about our own origin rather than a third party.
const isLocal = text => text.includes('127.0.0.1') || text.includes('localhost');

/** Keep `page` hermetic (anything outside `base` is aborted) and collect what
 *  should fail a check: page errors, console errors, failed local requests and
 *  any local response with status >= 400. The last needs its own listener:
 *  Chromium's console text for an HTTP error names no URL, so it looks like a
 *  third party's, and `requestfailed` never fires for an answered request.
 *  Returns the live array the listeners append to. */
export async function watchPage(page, base) {
  await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    // Count JS errors and *local* resource failures; ignore flaky external
    // fetches (live iframes, remote embeds) so CI stays hermetic.
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR/.test(t) && !isLocal(t)) return;
    // A remote site refusing to be framed (X-Frame-Options / frame-ancestors)
    // is the exact condition .site-frame's placeholder fallback exists for, and
    // it depends on the *remote* server's headers — so it says nothing about
    // this deck. Whether it fires at all depends on whether the runner has
    // network, which made the gate flaky in both directions.
    if (/(Content Security Policy directive: "frame-ancestors|in a frame because it set 'X-Frame-Options')/.test(t) && !isLocal(t)) return;
    errors.push(t);
  });
  page.on('response', r => {
    if (r.url().startsWith(base) && r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  page.on('requestfailed', async r => {
    if (r.url().startsWith(base) && !await isCancelledRequest(r)) {
      errors.push(`request failed (${r.failure()?.errorText}): ${r.url()}`);
    }
  });
  return errors;
}
