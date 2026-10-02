#!/usr/bin/env python3
"""Offline inventory and rehearsal estimate: preflight.py [--decks slug,...] [--exports DIR] [--json FILE]."""
import argparse
import json
import math
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

from slideslib.html_refs import DeckParser, is_local, local_path

ROOT = Path(__file__).resolve().parent.parent
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
BLOCK = {'aside', 'br', 'div', 'p', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre'}
FALLBACK_CLASSES = {'frame-fallback', 'viz-fallback', 'amrc-fallback'}


class NoteText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in BLOCK:
            self.parts.append(' ')

    def handle_endtag(self, tag):
        if tag in BLOCK:
            self.parts.append(' ')

    def handle_data(self, data):
        self.parts.append(data)


def note_text(value):
    parser = NoteText()
    parser.feed(value)
    return ''.join(parser.parts)


class PreflightParser(DeckParser):
    def __init__(self):
        super().__init__()
        self.slides, self.stack, self.elements = [], [], []
        self.frames = []
        self.network_links = []

    def handle_starttag(self, tag, attrs):
        super().handle_starttag(tag, attrs)
        values = dict(attrs)
        classes = set((values.get('class') or '').lower().split())
        if tag == 'link' and set((values.get('rel') or '').split()) & {'stylesheet', 'preload', 'modulepreload'}:
            self.network_links.append(values.get('href') or '')
        parent = self.elements[-1] if self.elements else None
        hidden = ('hidden' in values or values.get('data-visibility') == 'hidden'
                  or bool(parent and parent['hidden']))
        notes = tag == 'aside' and 'notes' in classes or bool(parent and parent['notes'])
        node = {'tag': tag, 'hidden': hidden, 'notes': notes,
                'fallback': bool(classes & FALLBACK_CLASSES) or bool(parent and parent['fallback']),
                'fallbackImages': []}
        if tag == 'section':
            if self.stack:
                self.stack[-1]['container'] = True
            slide = {'title': values.get('data-toc') or values.get('id') or 'Slide',
                     'hidden': hidden, 'appendix': values.get('data-visibility') == 'uncounted'
                     or bool(self.stack and self.stack[-1]['appendix']),
                     'notes': note_text(values.get('data-notes') or ''), 'container': False,
                     'timing': values.get('data-timing')}
            self.stack.append(slide)
            self.slides.append(slide)
        if self.stack and notes and tag in BLOCK:
            self.stack[-1]['notes'] += ' '
        if tag == 'img' and node['fallback']:
            url = values.get('src') or values.get('data-src')
            if url:
                for ancestor in self.elements:
                    ancestor['fallbackImages'].append(url)
        if tag == 'iframe' and not hidden:
            self.frames.append({'url': values.get('data-src') or values.get('src'),
                                'title': values.get('title'), 'readyMessage': values.get('data-ready-message'),
                                '_parent': parent})
        if tag not in VOID:
            self.elements.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        super().handle_endtag(tag)
        if self.stack and self.elements and self.elements[-1]['notes'] and tag in BLOCK:
            self.stack[-1]['notes'] += ' '
        if tag == 'section' and self.stack:
            self.stack.pop()
        for index in range(len(self.elements) - 1, -1, -1):
            if self.elements[index]['tag'] == tag:
                del self.elements[index:]
                break

    def handle_data(self, data):
        super().handle_data(data)
        if self.elements and self.elements[-1]['notes'] and self.stack:
            self.stack[-1]['notes'] += data


def inspect(deck, exports=None):
    parser = PreflightParser()
    parser.feed((deck / 'index.html').read_text(encoding='utf-8'))
    parser.close()
    slides = []
    for slide in parser.slides:
        if slide['container'] or slide['hidden']:
            continue
        words = len(re.findall(r'\S+', slide['notes']))
        slides.append({'title': slide['title'], 'appendix': slide['appendix'],
                       'noteWords': words, 'estimateSeconds': math.ceil(words / 130 * 60),
                       'authoredSeconds': slide['timing']})
    missing = []
    network_assets = []
    for kind, url in parser.refs:
        if not is_local(url):
            if kind not in {'a', 'iframe', 'link'} and (urlparse(url).scheme in {'http', 'https'} or url.startswith('//')):
                network_assets.append(url)
            continue
        if Path(urlparse(url).path).name in {'slides.pdf', 'social-card.png'}:
            continue
        path = local_path(str(deck), url, root=str(ROOT))
        if path and not Path(path).exists():
            missing.append(url)
    network_assets += [url for url in parser.network_links if urlparse(url).scheme in {'http', 'https'} or url.startswith('//')]
    for frame in parser.frames:
        parent = frame.pop('_parent')
        candidates = list(dict.fromkeys(parent['fallbackImages'] if parent else []))
        frame['fallbackImages'] = [url for url in candidates if is_local(url)
                                   and (target := local_path(str(deck), url, root=str(ROOT)))
                                   and Path(target).is_file()]
        frame['readiness'] = 'unverified'  # a declaration is not a browser observation
    evidence = None
    evidence_error = None
    if exports:
        path = Path(exports) / 'talks' / deck.name / 'export-evidence.json'
        if path.exists():
            try:
                evidence = json.loads(path.read_text(encoding='utf-8'))
                if not isinstance(evidence, dict):
                    raise ValueError('evidence must be a JSON object')
            except (ValueError, OSError) as exc:
                evidence_error = str(exc)
    qr = [url for kind, url in parser.refs if kind == 'img' and 'qr' in Path(urlparse(url).path).name.lower()]
    missing = sorted(set(missing))
    remote_frames = [frame for frame in parser.frames if frame['url'] and not is_local(frame['url'])]
    needs_network = network_assets or any(not frame['fallbackImages'] for frame in remote_frames)
    readiness = {
        'localAssets': 'missing' if missing else 'present',
        'offline': ('blocked' if missing else 'requires-network' if needs_network else
                    'fallbacks-present' if remote_frames else 'static-assets-present'),
        'liveFrames': 'unverified' if parser.frames else 'not-needed',
        'qr': 'unverified' if qr else 'not-needed',
        'export': 'invalid-evidence' if evidence_error else 'recorded' if evidence else 'not-checked',
    }
    return {'deck': deck.name, 'leafSlides': len(slides), 'slides': slides,
            'estimateMinutes': round(sum(s['estimateSeconds'] for s in slides if not s['appendix']) / 60, 1),
            'missingLocalAssets': missing, 'liveFrames': parser.frames,
            'networkAssets': sorted(set(network_assets)), 'qrImages': qr,
            'readiness': readiness, 'export': evidence, 'exportEvidenceError': evidence_error}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--decks', help='comma-separated folder names')
    ap.add_argument('--exports', help='publication build containing export-evidence.json')
    ap.add_argument('--json', help='write the full inventory')
    args = ap.parse_args()
    wanted = {slug.strip() for slug in args.decks.split(',') if slug.strip()} if args.decks else None
    decks = sorted(p.parent for p in (ROOT / 'talks').glob('*/index.html') if not p.parent.name.startswith('_'))
    if wanted:
        unknown = wanted - {p.name for p in decks}
        if unknown:
            ap.error('unknown decks: ' + ', '.join(sorted(unknown)))
        decks = [p for p in decks if p.name in wanted]
    records = [inspect(deck, args.exports) for deck in decks]
    for record in records:
        print(f"{record['deck']}: {record['leafSlides']} slides; notes ~{record['estimateMinutes']} min at 130 wpm; "
              f"offline={record['readiness']['offline']}; {len(record['liveFrames'])} unverified live frames; "
              f"{len(record['missingLocalAssets'])} missing assets")
    print('Timing estimates exclude pauses and demonstrations. Static inventory does not verify live readiness, '
          'QR destinations, or export freshness; rehearse with the network disconnected.')
    if args.json:
        Path(args.json).write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return int(any(r['missingLocalAssets'] or r['exportEvidenceError'] for r in records))


if __name__ == '__main__':
    raise SystemExit(main())
