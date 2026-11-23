"""Rehearsal inventory regressions: notes, nesting, and evidence boundaries."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import preflight


class PreflightInventory(unittest.TestCase):
    def inspect(self, source, assets=(), evidence=None):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            deck = root / 'talks' / 'demo'
            deck.mkdir(parents=True)
            (deck / 'index.html').write_text(source)
            for name in assets:
                (deck / name).parent.mkdir(parents=True, exist_ok=True)
                (deck / name).write_bytes(b'asset')
            exports = root / 'exports'
            if evidence is not None:
                dest = exports / 'talks' / 'demo'
                dest.mkdir(parents=True)
                (dest / 'export-evidence.json').write_text(evidence)
            with patch.object(preflight, 'ROOT', root):
                return preflight.inspect(deck, exports)

    def test_block_boundaries_and_inline_emphasis_preserve_words(self):
        result = self.inspect('<section><aside class="notes"><p>One <em>two</em></p><p>three<br>four</p></aside></section>')
        self.assertEqual(result['slides'][0]['noteWords'], 4)

    def test_data_notes_and_separate_asides_are_counted(self):
        result = self.inspect('<section data-notes="One &lt;p&gt;two&lt;/p&gt;"><aside class="notes">three</aside><aside class="notes">four</aside></section>')
        self.assertEqual(result['slides'][0]['noteWords'], 4)

    def test_hidden_ancestors_and_vertical_stacks_match_visible_leaves(self):
        result = self.inspect('<section data-visibility="hidden"><section><aside class="notes">secret</aside></section></section>'
                              '<section><section id="a"></section><section id="b" data-visibility="uncounted"></section></section>'
                              '<div hidden><section id="hidden"></section></div>')
        self.assertEqual(result['leafSlides'], 2)
        self.assertEqual([slide['title'] for slide in result['slides']], ['a', 'b'])
        self.assertTrue(result['slides'][1]['appendix'])

    def test_declared_handshake_does_not_claim_live_readiness(self):
        result = self.inspect('<section><div><iframe title="live" data-src="https://example.test/app" data-ready-message="app:ready"></iframe>'
                              '<img class="frame-fallback" src="assets/fallback.png" alt="Snapshot"></div></section>',
                              ['assets/fallback.png'])
        self.assertEqual(result['readiness']['liveFrames'], 'unverified')
        self.assertEqual(result['readiness']['offline'], 'fallbacks-present')
        self.assertEqual(result['liveFrames'][0]['fallbackImages'], ['assets/fallback.png'])

    def test_remote_stylesheet_needs_network_but_canonical_does_not(self):
        self.assertEqual(self.inspect('<link rel="canonical" href="https://example.test/deck"><section></section>')['readiness']['offline'], 'static-assets-present')
        self.assertEqual(self.inspect('<link rel="stylesheet" href="//example.test/style.css"><section></section>')['readiness']['offline'], 'requires-network')

    def test_missing_fallback_is_blocked_and_bad_evidence_reported(self):
        result = self.inspect('<section><iframe title="demo" src="https://example.test"></iframe><img class="frame-fallback" src="missing.png" alt="missing"></section>', evidence='{broken')
        self.assertEqual(result['readiness']['offline'], 'blocked')
        self.assertEqual(result['readiness']['export'], 'invalid-evidence')

    def test_recorded_evidence_does_not_claim_freshness(self):
        result = self.inspect('<section></section>', evidence=json.dumps({'createdAt': '2001-01-01'}))
        self.assertEqual(result['readiness']['export'], 'recorded')


def slide(text='A short line.', notes='Something the slide does not say, told aloud.', extra='', cls=''):
    return (f'<section class="{cls}"><h2>Title</h2><p>{text}</p>{extra}'
            f'<aside class="notes">{notes}</aside></section>')


class CraftDiagnostics(unittest.TestCase):
    """Advisory craft checks (#37): each fires on its known-bad deck."""

    def craft(self, source, assets=(), slot=None):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            deck = root / 'talks' / 'demo'
            deck.mkdir(parents=True)
            (deck / 'index.html').write_text(source, encoding='utf-8')
            for name in assets:
                (deck / name).parent.mkdir(parents=True, exist_ok=True)
                (deck / name).write_bytes(b'asset')
            with patch.object(preflight, 'ROOT', root):
                return preflight.inspect(deck, None, slot)['craft']

    def checks(self, source, **kwargs):
        return [item['check'] for item in self.craft(source, **kwargs)]

    def test_a_clean_deck_gets_no_advice(self):
        deck = (slide(cls='cover') + slide() + slide(extra='<img src="a.png" alt="x">') + slide()
                + slide(cls='closing'))
        self.assertEqual(self.checks(deck), [])

    def test_a_long_run_of_plain_text_slides(self):
        self.assertEqual(self.checks(slide() * 5), [])
        self.assertIn('plain-run', self.checks(slide() * 6))
        broken = slide() * 3 + slide(extra='<figure><img src="a.png" alt="x"></figure>') + slide() * 3
        self.assertNotIn('plain-run', self.checks(broken))

    def test_a_crowded_slide(self):
        self.assertIn('crowded', self.checks(slide(text='word ' * 91)))
        self.assertNotIn('crowded', self.checks(slide(text='word ' * 80)))

    def test_notes_that_read_the_slide_aloud(self):
        text = 'Archives remember names; models forget places quickly without careful human review.'
        self.assertIn('teleprompter', self.checks(slide(text=text, notes='So: ' + text)))
        self.assertNotIn('teleprompter', self.checks(slide(text=text)))

    def test_a_content_slide_with_no_notes(self):
        self.assertIn('no-notes', self.checks(slide(notes='')))
        self.assertNotIn('no-notes', self.checks(slide(notes='', cls='cover')))

    def test_a_live_frame_with_no_saved_view(self):
        frame = '<div><iframe title="live" data-src="https://example.test/app"></iframe>{}</div>'
        self.assertIn('frame-without-fallback', self.checks(slide(extra=frame.format(''))))
        saved = frame.format('<img class="frame-fallback" src="assets/f.png" alt="Snapshot">')
        self.assertNotIn('frame-without-fallback',
                         self.checks(slide(extra=saved), assets=['assets/f.png']))

    def test_highlight_js_with_nothing_to_highlight(self):
        script = '<script src="../../shared/highlight.min.js"></script>'
        self.assertIn('unused-highlight', self.checks(slide() + script))
        self.assertNotIn('unused-highlight',
                         self.checks(slide(extra='<pre><code>x = 1</code></pre>') + script))
        self.assertNotIn('unused-highlight',
                         self.checks(slide(extra='<div data-embed-src="a.md"></div>') + script))

    def test_notes_over_the_stated_slot(self):
        long_notes = 'talk ' * 400          # ~3.1 min at 130 wpm
        self.assertIn('over-slot', self.checks(slide(notes=long_notes), slot=2))
        self.assertNotIn('over-slot', self.checks(slide(notes=long_notes), slot=5))
        self.assertNotIn('over-slot', self.checks(slide(notes=long_notes)))

    def test_scripts_styles_hidden_and_notes_are_not_on_screen(self):
        hidden = ('<style>.x { color: red; }</style><script>var a = "b c d";</script>'
                  '<p hidden>' + 'secret ' * 100 + '</p><div aria-hidden="true">' + 'deco ' * 100 + '</div>')
        self.assertNotIn('crowded', self.checks(slide(extra=hidden, notes='word ' * 200)))

    def test_advice_never_changes_the_exit_status(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            deck = root / 'talks' / 'demo'
            deck.mkdir(parents=True)
            (deck / 'index.html').write_text(slide(notes='') * 8 + slide(text='word ' * 200),
                                             encoding='utf-8')
            with patch.object(preflight, 'ROOT', root), \
                    patch('sys.argv', ['preflight.py']), \
                    patch('builtins.print'):
                self.assertEqual(preflight.main(), 0)


if __name__ == '__main__':
    unittest.main()
