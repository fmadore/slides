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


if __name__ == '__main__':
    unittest.main()
