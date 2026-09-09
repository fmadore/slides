#!/usr/bin/env python3
"""Offline inventory and rehearsal estimate: preflight.py [--decks slug,...] [--exports DIR] [--json FILE]."""
import argparse
import json
import math
import re
from pathlib import Path

from audit import DeckParser, is_local, local_path

ROOT = Path(__file__).resolve().parent.parent


class PreflightParser(DeckParser):
    def __init__(self):
        super().__init__()
        self.slides, self.stack, self.note_depth = [], [], 0
        self.frames = []

    def handle_starttag(self, tag, attrs):
        super().handle_starttag(tag, attrs)
        values = dict(attrs)
        if tag == 'section':
            if self.stack:
                self.stack[-1]['container'] = True
            slide = {'title': values.get('data-toc') or values.get('id') or 'Slide',
                     'visibility': values.get('data-visibility'), 'notes': '', 'container': False,
                     'timing': values.get('data-timing')}
            self.stack.append(slide)
            self.slides.append(slide)
        if tag == 'aside' and (self.note_depth or 'notes' in (values.get('class') or '').split()):
            self.note_depth += 1
        if tag == 'iframe':
            self.frames.append({'url': values.get('data-src') or values.get('src'),
                                'title': values.get('title'), 'readyMessage': values.get('data-ready-message')})

    def handle_endtag(self, tag):
        super().handle_endtag(tag)
        if tag == 'section' and self.stack:
            self.stack.pop()
        if tag == 'aside' and self.note_depth:
            self.note_depth -= 1

    def handle_data(self, data):
        super().handle_data(data)
        if self.note_depth and self.stack:
            self.stack[-1]['notes'] += data


def inspect(deck, exports=None):
    parser = PreflightParser()
    parser.feed((deck / 'index.html').read_text(encoding='utf-8'))
    slides = []
    for slide in parser.slides:
        if slide['container'] or slide['visibility'] == 'hidden':
            continue
        words = len(re.findall(r'\S+', slide['notes']))
        slides.append({'title': slide['title'], 'appendix': slide['visibility'] == 'uncounted',
                       'noteWords': words, 'estimateSeconds': math.ceil(words / 130 * 60),
                       'authoredSeconds': slide['timing']})
    missing = []
    for kind, url in parser.refs:
        if not is_local(url) or Path(url).name in {'slides.pdf', 'social-card.png'}:
            continue
        path = local_path(str(deck), url, root=str(ROOT))
        if path and not Path(path).exists():
            missing.append(url)
    evidence = None
    if exports:
        path = Path(exports) / 'talks' / deck.name / 'export-evidence.json'
        if path.exists():
            evidence = json.loads(path.read_text(encoding='utf-8'))
    return {'deck': deck.name, 'leafSlides': len(slides), 'slides': slides,
            'estimateMinutes': round(sum(s['estimateSeconds'] for s in slides if not s['appendix']) / 60, 1),
            'missingLocalAssets': sorted(set(missing)), 'liveFrames': parser.frames,
            'qrImages': [url for kind, url in parser.refs if kind == 'img' and 'qr' in Path(url).name.lower()],
            'export': evidence}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--decks', help='comma-separated folder names')
    ap.add_argument('--exports', help='publication build containing export-evidence.json')
    ap.add_argument('--json', help='write the full inventory')
    args = ap.parse_args()
    wanted = set(args.decks.split(',')) if args.decks else None
    decks = sorted(p.parent for p in (ROOT / 'talks').glob('*/index.html') if not p.parent.name.startswith('_'))
    if wanted:
        unknown = wanted - {p.name for p in decks}
        if unknown:
            ap.error('unknown decks: ' + ', '.join(sorted(unknown)))
        decks = [p for p in decks if p.name in wanted]
    records = [inspect(deck, args.exports) for deck in decks]
    for record in records:
        print(f"{record['deck']}: {record['leafSlides']} slides; notes ~{record['estimateMinutes']} min at 130 wpm; "
              f"{len(record['liveFrames'])} live frames; {len(record['missingLocalAssets'])} missing assets")
    print('Timing estimates exclude pauses and demonstrations. QR images are inventoried, not decoded.')
    if args.json:
        Path(args.json).write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return int(any(r['missingLocalAssets'] for r in records))


if __name__ == '__main__':
    raise SystemExit(main())
