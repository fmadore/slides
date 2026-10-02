#!/usr/bin/env python3
"""Build a notes-free rehearsal ZIP: offline-pack.py OUTPUT.zip [--decks slug,...]."""
import argparse
import html
import importlib.util
import json
import os
import re
import tempfile
import zipfile
from pathlib import Path
from html.parser import HTMLParser

from slideslib.manifest import load_manifest
from slideslib.publication import generated_export, reference_errors
from slideslib.html_refs import is_local, local_path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('slides_publisher', Path(__file__).with_name('strip-notes.py'))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

START = '''Offline rehearsal bundle

1. Unzip this entire archive; keep shared/ beside talks/.
2. In the extracted folder run: python3 serve.py
   On Windows: py serve.py
3. Open http://127.0.0.1:8742/ and disconnect the network to rehearse.

Speaker notes and the speaker-notes plugin are excluded. The source repository
may still contain notes. Static assets and authored screenshots are included;
external sites, live demos, and external links still need a network connection.
PDFs generated during deployment are not bundled; their links open the public site.
No browser rehearsal or successful live capture is implied by this bundle.
'''
SERVER = '''"""Serve this extracted rehearsal archive on loopback only."""
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
os.chdir(Path(__file__).resolve().parent)
print('Open http://127.0.0.1:8742/ (Ctrl+C to stop)')
try:
    ThreadingHTTPServer(('127.0.0.1', 8742), SimpleHTTPRequestHandler).serve_forever()
except KeyboardInterrupt:
    pass
'''



def redirect_unbundled_exports(site, canonical):
    """A reading edition's PDF link must not point at a missing ZIP member."""
    class ExportLinks(HTMLParser):
        def __init__(self, source, path):
            super().__init__(convert_charrefs=True)
            self.source, self.path, self.spans = source, path, []
            self.lines = [0] + [match.end() for match in re.finditer('\n', source)]

        def handle_starttag(self, tag, attrs):
            href = dict(attrs).get('href')
            if tag != 'a' or not href or not is_local(href):
                return
            target = Path(local_path(str(self.path.parent), href, str(site)))
            if target.exists() or not generated_export(target, site):
                return
            raw = self.get_starttag_text()
            updated = re.sub(r"\bhref\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)",
                'href="' + html.escape(canonical.rstrip('/') + '/' + target.relative_to(site).as_posix(), quote=True) + '"',
                raw, count=1, flags=re.I)
            line, column = self.getpos()
            start = self.lines[line - 1] + column
            self.spans.append((start, start + len(raw), updated))

    for path in site.rglob('*.html'):
        source = path.read_text(encoding='utf-8')
        parser = ExportLinks(source, path)
        parser.feed(source)
        for start, end, replacement in reversed(parser.spans):
            source = source[:start] + replacement + source[end:]
        if parser.spans:
            path.write_text(source, encoding='utf-8')

def pack(source, output, wanted=None):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output.suffix.lower() != '.zip':
        raise ValueError('output must end in .zip')
    if any(output.is_relative_to(source / name) for name in ('talks', 'shared', 'tools', '.git')):
        raise ValueError('output overlaps source inputs')
    manifest = load_manifest(source / 'talks' / 'talks.json')
    selected = [talk for talk in manifest.talks if wanted is None or talk.slug in wanted]
    unknown = set(wanted or ()) - {talk.slug for talk in manifest.talks}
    if unknown:
        raise ValueError('unknown decks: ' + ', '.join(sorted(unknown)))
    if not selected:
        raise ValueError('select at least one published talk')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.slides-offline-', dir=output.parent) as directory:
        staging = Path(directory)
        site = staging / 'site'
        publisher.build(str(source), str(site))
        selected_slugs = {talk.slug for talk in selected}
        import shutil
        for deck in (site / 'talks').iterdir():
            if deck.is_dir() and deck.name not in selected_slugs:
                shutil.rmtree(deck)
        for name in (publisher.BUILD_MARKER, 'CNAME', 'sitemap.xml', 'robots.txt', '404.html'):
            (site / name).unlink(missing_ok=True)
        links = []
        for talk in selected:
            title = html.escape(talk.title)
            href = f'talks/{talk.slug}/'
            reading = (f' · <a href="{href}read.html">Read</a>'
                       if (site / href / 'read.html').is_file() else '')
            links.append(f'<li><a href="{href}">{title}</a>{reading}</li>')
        (site / 'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Offline rehearsal</title><h1>Offline rehearsal</h1>'
            '<p>Static assets and authored fallbacks are included. Live demos and external links require a network.</p>'
            '<ul>' + ''.join(links) + '</ul><p>See START.txt for instructions.</p></html>', encoding='utf-8')
        (site / 'START.txt').write_text(START, encoding='utf-8')
        (site / 'serve.py').write_text(SERVER, encoding='utf-8')
        (site / 'offline-manifest.json').write_text(json.dumps({
            'formatVersion': 1, 'notesIncluded': False,
            'talks': [talk.slug for talk in selected],
            'networkRehearsalVerified': False,
        }, indent=2) + '\n', encoding='utf-8')
        redirect_unbundled_exports(site, manifest.site)
        broken = list(reference_errors(site))
        if broken:
            raise ValueError('offline references failed (include linked decks): ' + '; '.join(
                f'{path}: {message}' for path, message in broken))
        archive = staging / 'rehearsal.zip'
        with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as zipped:
            for path in sorted(site.rglob('*')):
                if path.is_file():
                    info = zipfile.ZipInfo(path.relative_to(site).as_posix(), (1980, 1, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    zipped.writestr(info, path.read_bytes())
        os.replace(archive, output)
    return selected_slugs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', help='destination ZIP file')
    parser.add_argument('--decks', help='comma-separated published folder names; defaults to all')
    args = parser.parse_args()
    wanted = {slug.strip() for slug in args.decks.split(',') if slug.strip()} if args.decks else None
    try:
        selected = pack(ROOT, args.output, wanted)
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    print(f'Created {args.output}: {len(selected)} talk(s), shared runtime and authored fallbacks; no speaker notes.')


if __name__ == '__main__':
    main()
