#!/usr/bin/env python3
"""Offline inventory and rehearsal estimate: preflight.py [--decks slug,...] [--exports DIR] [--json FILE].

Besides the inventory, each deck gets advisory craft diagnostics (`craft` in
the JSON, "advice" lines on the console): long runs of plain text slides,
crowded slides, notes that read the slide aloud or are missing, live frames
with no saved view, highlight.js with no code to highlight, and a notes
estimate over the deck's stated slot. They are drafting prompts, never
failures: the exit status ignores them, so delivered talks stay green.
"""
import argparse
import json
import math
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

from slideslib.html_refs import DeckParser, is_local, local_path
from slideslib.manifest import ManifestValidationError, load_manifest

ROOT = Path(__file__).resolve().parent.parent
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
BLOCK = {'aside', 'br', 'div', 'p', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre'}
FALLBACK_CLASSES = {'frame-fallback', 'viz-fallback', 'amrc-fallback'}

# Craft thresholds: starting points, to tune against decks that went well.
MAX_PLAIN_RUN = 5           # consecutive text-only content slides
MAX_SCREEN_WORDS = 90       # words a hall reads on one slide
TELEPROMPTER_SHARE = 0.8    # share of a slide's words its notes repeat
TELEPROMPTER_MIN_WORDS = 8  # distinct on-screen words before the share means anything
# A slide carrying any of these shows the hall something other than text.
VISUAL_TAGS = {'img', 'svg', 'iframe', 'video', 'canvas', 'table', 'figure', 'pre', 'picture', 'object'}
VISUAL_CLASSES = {'stat', 'stat-grid', 'barchart', 'pipeline', 'scroll-panel', 'site-frame'}
# Layouts that are not content slides: the cover, dividers, statements, the close.
HERO_CLASSES = {'cover', 'section', 'statement', 'closing', 'metric', 'center'}
SKIP_TEXT = {'script', 'style', 'template', 'noscript'}
WORD_RE = re.compile(r"[^\W\d_][\w'’-]*", re.UNICODE)


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
        self.pre_code = self.embeds = self.highlight = False

    def handle_starttag(self, tag, attrs):
        super().handle_starttag(tag, attrs)
        values = dict(attrs)
        classes = set((values.get('class') or '').lower().split())
        if tag == 'script' and Path(urlparse(values.get('src') or '').path).name == 'highlight.min.js':
            self.highlight = True
        if tag == 'link' and set((values.get('rel') or '').split()) & {'stylesheet', 'preload', 'modulepreload'}:
            self.network_links.append(values.get('href') or '')
        parent = self.elements[-1] if self.elements else None
        hidden = ('hidden' in values or values.get('data-visibility') == 'hidden'
                  or bool(parent and parent['hidden']))
        notes = tag == 'aside' and 'notes' in classes or bool(parent and parent['notes'])
        skip = (tag in SKIP_TEXT or values.get('aria-hidden') == 'true'
                or bool(parent and parent['skip']))
        node = {'tag': tag, 'hidden': hidden, 'notes': notes, 'skip': skip,
                'fallback': bool(classes & FALLBACK_CLASSES) or bool(parent and parent['fallback']),
                'fallbackImages': []}
        if tag == 'section':
            if self.stack:
                self.stack[-1]['container'] = True
            slide = {'title': values.get('data-toc') or values.get('id') or 'Slide',
                     'hidden': hidden, 'appendix': values.get('data-visibility') == 'uncounted'
                     or bool(self.stack and self.stack[-1]['appendix']),
                     'notes': note_text(values.get('data-notes') or ''), 'container': False,
                     'timing': values.get('data-timing'), 'screen': '',
                     'classes': classes, 'visual': False}
            self.stack.append(slide)
            self.slides.append(slide)
        elif self.stack and not notes and (tag in VISUAL_TAGS or classes & VISUAL_CLASSES
                                           or values.get('data-embed-src') or values.get('data-skill-src')):
            self.stack[-1]['visual'] = True
        if tag == 'code' and parent and parent['tag'] == 'pre':
            self.pre_code = True
        if values.get('data-embed-src') or values.get('data-skill-src'):
            self.embeds = True
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
        elif self.stack and not (self.elements and (self.elements[-1]['skip'] or self.elements[-1]['hidden'])):
            self.stack[-1]['screen'] += ' ' + data


def words(text):
    return WORD_RE.findall(text)


def craft_diagnostics(slides, frames, parser, estimate_minutes, slot_minutes):
    """Advisory delivery checks (see the module docstring). Never a failure."""
    advice = []

    def add(check, message, slide=None):
        advice.append({'check': check, 'slide': slide, 'message': message})

    main = [s for s in slides if not s['appendix']]
    content = [s for s in main if not s['classes'] & HERO_CLASSES]
    run, longest = [], []
    for slide in main:
        if slide in content and not slide['visual']:
            run.append(slide['title'])
            if len(run) > len(longest):
                longest = list(run)
        else:
            run = []
    if len(longest) > MAX_PLAIN_RUN:
        add('plain-run', f"{len(longest)} plain text slides in a row ({longest[0]} to {longest[-1]}); "
                         f"a figure, a statement or a divider would give the hall a breath")
    for slide in main:
        screen = words(slide['screen'])
        if len(screen) > MAX_SCREEN_WORDS:
            add('crowded', f"{len(screen)} words on screen (about {MAX_SCREEN_WORDS} at most reads "
                           f"in a hall)", slide['title'])
        if slide not in content:
            continue
        if not slide['noteWords']:
            add('no-notes', 'content slide with no speaker notes', slide['title'])
            continue
        shown = {w.lower() for w in screen if len(w) > 3}
        said = {w.lower() for w in words(slide['notes'])}
        if len(shown) >= TELEPROMPTER_MIN_WORDS and len(shown & said) / len(shown) >= TELEPROMPTER_SHARE:
            add('teleprompter', f"the notes repeat {round(100 * len(shown & said) / len(shown))}% of "
                                f"the words on screen; the talk should add to the slide, not read it",
                slide['title'])
    for frame in frames:
        if frame['url'] and not is_local(frame['url']) and not frame['fallbackImages']:
            add('frame-without-fallback', f"live frame {frame['title'] or frame['url']} has no saved "
                                          f"fallback image for a dead network")
    if parser.highlight and not (parser.pre_code or parser.embeds):
        add('unused-highlight', 'loads highlight.min.js but has no <pre><code> or file embed to highlight')
    if slot_minutes and estimate_minutes > slot_minutes:
        add('over-slot', f"notes alone run ~{estimate_minutes} min at 130 wpm against a "
                         f"{slot_minutes}-minute slot, before pauses and demonstrations")
    return advice


def inspect(deck, exports=None, slot_minutes=None):
    parser = PreflightParser()
    parser.feed((deck / 'index.html').read_text(encoding='utf-8'))
    parser.close()
    slides, craft_slides = [], []
    for slide in parser.slides:
        if slide['container'] or slide['hidden']:
            continue
        words = len(re.findall(r'\S+', slide['notes']))
        slides.append({'title': slide['title'], 'appendix': slide['appendix'],
                       'noteWords': words, 'estimateSeconds': math.ceil(words / 130 * 60),
                       'authoredSeconds': slide['timing']})
        craft_slides.append({**slides[-1], 'title': f"slide {len(slides)}" + (
                                 '' if slide['title'] == 'Slide' else f" ({slide['title']})"),
                             'notes': slide['notes'], 'screen': slide['screen'],
                             'classes': slide['classes'], 'visual': slide['visual']})
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
    estimate = round(sum(s['estimateSeconds'] for s in slides if not s['appendix']) / 60, 1)
    craft = craft_diagnostics(craft_slides, parser.frames, parser, estimate, slot_minutes)
    return {'deck': deck.name, 'leafSlides': len(slides), 'slides': slides,
            'estimateMinutes': estimate, 'slotMinutes': slot_minutes, 'craft': craft,
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
    try:
        slots = {talk.slug: talk.duration_minutes for talk in load_manifest(ROOT / 'talks' / 'talks.json').talks}
    except (OSError, ValueError, ManifestValidationError):
        slots = {}              # the slot check is advisory; the audit owns the manifest
    records = [inspect(deck, args.exports, slots.get(deck.name)) for deck in decks]
    for record in records:
        print(f"{record['deck']}: {record['leafSlides']} slides; notes ~{record['estimateMinutes']} min at 130 wpm; "
              f"offline={record['readiness']['offline']}; {len(record['liveFrames'])} unverified live frames; "
              f"{len(record['missingLocalAssets'])} missing assets")
        for item in record['craft']:
            where = f" [{item['slide']}]" if item['slide'] else ''
            print(f"  advice ({item['check']}){where}: {item['message']}")
    print('Timing estimates exclude pauses and demonstrations. Static inventory does not verify live readiness, '
          'QR destinations, or export freshness; rehearse with the network disconnected.')
    if args.json:
        Path(args.json).write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # Craft advice never changes the exit status.
    return int(any(r['missingLocalAssets'] or r['exportEvidenceError'] for r in records))


if __name__ == '__main__':
    raise SystemExit(main())
