#!/usr/bin/env python3
"""Build a SLIM, offline highlight.js for the deck.

The reveal.js highlight *plugin* we used to vendor bundles every language and
weighs ~921 KB. A talk needs a handful of grammars at most. This script pulls
highlight.js core plus only the LANGUAGES you list from the official
cdn-release ESM build, converts them to one classic <script> (exposing
`window.hljs`), and writes it to ../shared/highlight.min.js — typically
30-60 KB instead of 921 KB.

deck.js highlights every <pre><code> via `window.hljs`, so once this file is
loaded the bundled reveal highlight plugin is no longer needed (see README).

Re-run if you change LANGUAGES or VERSION. Build helper, not a runtime
dependency — needs a network connection once; safe to delete afterwards.

Before publication, the generated file is syntax-checked and executed in an
isolated Node VM (Node is required) and its version + sha256 are recorded in
shared/vendor-manifest.json so the provenance of the vendored bundle stays
auditable.
"""
import hashlib
import json
import os
import re
import subprocess
import urllib.request
import tempfile
from pathlib import Path

# Pin a version so builds are reproducible. Bump deliberately.
VERSION = "11.12.0"
# Both serve the identical highlightjs/cdn-release tag; the first that
# responds wins (some networks block one CDN or the other).
MIRRORS = [
    f"https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@{VERSION}/build/es",
    f"https://raw.githubusercontent.com/highlightjs/cdn-release/{VERSION}/build/es",
]
BASE = MIRRORS[0]

# The grammars your slides actually use. Add/remove freely — each one is a few KB.
# Names must match highlight.js language ids (the filename under build/es/languages/).
LANGUAGES = [
    "bash",
    "python",
    "json",
    "javascript",
    "xml",        # also powers HTML
    "markdown",
    "yaml",
]

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared", "highlight.min.js")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def get(path: str) -> str:
    global BASE
    last = None
    for base in MIRRORS:
        try:
            text = urllib.request.urlopen(
                urllib.request.Request(f"{base}/{path}", headers={"User-Agent": UA}), timeout=30
            ).read().decode("utf-8")
            BASE = base
            return text
        except Exception as e:      # try the next mirror
            last = e
    raise last


def strip_exports(src: str) -> str:
    """Turn an ESM module's single default export into a `return`, so the
    module body can run inside an IIFE that yields that default value.
    highlight.js core and language modules export exactly one default and
    import nothing, which is what makes this safe."""
    src = re.sub(r"export\s*\{\s*([\w$]+)\s+as\s+default\s*\}\s*;?", r";return \1;", src)
    src = re.sub(r"export\s+default\s+", "return ", src)
    return src


def validate_bundle(path):
    """Parse and execute in an isolated Node VM before either public file moves."""
    subprocess.run(["node", "--check", str(path)], check=True)
    probe = r"""
const fs = require('node:fs'), vm = require('node:vm');
const context = {window: {}};
vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), context, {timeout: 5000});
const hljs = context.window.hljs;
if (!hljs || hljs.versionString !== process.argv[2]) throw Error('incorrect highlight.js version');
for (const language of JSON.parse(process.argv[3])) {
  if (!hljs.getLanguage(language)) throw Error('missing grammar: ' + language);
  hljs.highlight('example', {language});
}
"""
    subprocess.run(["node", "-e", probe, str(path), VERSION, json.dumps(LANGUAGES)], check=True)


def replace_pair(staged_bundle, staged_manifest, bundle_path, manifest_path):
    """Rollback the first replacement if publishing the manifest fails.

    Readers may see the narrow two-rename window; no partial pair is left on
    ordinary I/O errors. Both original files stay untouched until validation.
    """
    targets = ((Path(staged_bundle), Path(bundle_path)), (Path(staged_manifest), Path(manifest_path)))
    originals = {target: target.read_bytes() if target.exists() else None for _, target in targets}
    replaced = []
    try:
        for stage, target in targets:
            os.replace(stage, target)
            replaced.append(target)
    except BaseException:
        for target in reversed(replaced):
            original = originals[target]
            if original is None:
                target.unlink(missing_ok=True)
            else:
                restore = Path(staged_bundle).parent / (target.name + '.restore')
                restore.write_bytes(original)
                try:
                    os.replace(restore, target)
                except OSError as rollback_error:
                    # Staging is normally removed by the caller. Keep a durable
                    # recovery copy beside the target when the OS blocks rollback.
                    fd, recovery = tempfile.mkstemp(prefix=f'.highlight-recovery-{target.name}-', dir=target.parent)
                    with os.fdopen(fd, 'wb') as handle:
                        handle.write(original)
                    raise RuntimeError(f'rollback failed; previous {target.name} preserved at {recovery}') from rollback_error
        raise


def build_bundle(out=OUT):
    """Generate, validate, and publish the bundle and provenance as one operation."""
    out = Path(out).resolve()
    manifest_path = out.parent / 'vendor-manifest.json'
    original_manifest = manifest_path.read_bytes() if manifest_path.exists() else None
    manifest = json.loads(original_manifest) if original_manifest is not None else {}
    if not isinstance(manifest, dict):
        raise ValueError('vendor manifest must be a JSON object')
    sources = {}
    core = strip_exports(get('core.min.js'))
    sources['core.min.js'] = BASE + '/core.min.js'
    chunks = [
        '/* Slim highlight.js — generated by tools/fetch-highlight.py. */',
        f"/* highlight.js {VERSION} · core + {', '.join(LANGUAGES)} */",
        '(function(){',
        'var hljs=(function(){' + core + '})();',
    ]
    for lang in LANGUAGES:
        path = f'languages/{lang}.min.js'
        body = strip_exports(get(path))
        sources[path] = BASE + '/' + path
        chunks.append('hljs.registerLanguage("%s",(function(){%s})());' % (lang, body))
    chunks += ['window.hljs=hljs;', '})();']
    source = '\n'.join(chunks) + '\n'
    manifest['highlight.js'] = {
        'version': VERSION, 'languages': LANGUAGES, 'source': BASE,
        'sources': sources, 'file': out.name,
        'sha256': hashlib.sha256(source.encode('utf-8')).hexdigest(),
    }
    with tempfile.TemporaryDirectory(prefix='.highlight-stage-', dir=out.parent) as directory:
        staged_bundle = Path(directory) / 'highlight.js'
        staged_manifest = Path(directory) / 'vendor-manifest.json'
        staged_bundle.write_text(source, encoding='utf-8', newline='\n')
        staged_manifest.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
        validate_bundle(staged_bundle)
        # Do not overwrite another dependency update made during downloads.
        current = manifest_path.read_bytes() if manifest_path.exists() else None
        if current != original_manifest:
            raise RuntimeError('vendor manifest changed during generation; retry with the new manifest')
        replace_pair(staged_bundle, staged_manifest, out, manifest_path)
    return len(source.encode('utf-8'))


def main():
    print(f"highlight.js {VERSION} — core + {len(LANGUAGES)} language(s)")
    try:
        size = build_bundle()
    except FileNotFoundError as exc:
        raise SystemExit(f'Bundle not published: {exc}. Node is required for validation.') from exc
    print(f"Validated and wrote {os.path.relpath(OUT)} ({size / 1024:.0f} KB) and vendor manifest")


if __name__ == '__main__':
    main()
