"""ZIP contents, private-note removal, and publication failure atomicity."""
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from test_manifest import talk

spec = importlib.util.spec_from_file_location('offline_pack', Path(__file__).with_name('offline-pack.py'))
offline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offline)


class OfflineBundle(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'repo'
        self.deck = self.root / 'talks' / talk()['slug']
        (self.deck / 'assets' / 'src').mkdir(parents=True)
        (self.root / 'shared' / 'reveal' / 'plugin').mkdir(parents=True)
        (self.root / 'shared' / 'src').mkdir()
        self.output = Path(self.temp.name) / 'rehearsal.zip'
        (self.root / 'talks' / 'talks.json').write_text(json.dumps({'site': 'https://slides.example.test', 'talks': [talk()]}))
        (self.root / 'index.html').write_text('<html>Landing</html>')
        (self.root / 'CNAME').write_text('slides.example.test')
        (self.root / 'shared' / 'deck.js').write_text('/* runtime */')
        (self.root / 'shared' / 'src' / 'part.js').write_text('/* development source */')
        (self.root / 'shared' / 'reveal' / 'plugin' / 'notes.js').write_text('/* notes plugin */')
        (self.deck / 'assets' / 'src' / 'snapshot.png').write_bytes(b'local fallback image')
        (self.deck / 'index.html').write_text('<html><section data-notes="private attribute"><aside class="notes">private cue</aside>'
            '<img class="frame-fallback" src="assets/src/snapshot.png" alt="Snapshot"></section>'
            '<script src="../../shared/deck.js"></script><script src="../../shared/reveal/plugin/notes.js"></script></html>')

    def test_archive_contains_runtime_fallbacks_and_no_notes(self):
        offline.pack(self.root, self.output)
        with zipfile.ZipFile(self.output) as archive:
            names = archive.namelist()
            self.assertIn('shared/deck.js', names)
            self.assertIn(f'talks/{talk()["slug"]}/assets/src/snapshot.png', names)
            self.assertIn('serve.py', names)
            self.assertNotIn('shared/src/part.js', names)
            self.assertNotIn('shared/reveal/plugin/notes.js', names)
            self.assertNotIn('.slides-build.json', names)
            self.assertNotIn('CNAME', names)
            source = archive.read(f'talks/{talk()["slug"]}/index.html').decode()
            self.assertNotIn('private', source)
            self.assertNotIn('data-notes', source)
            self.assertNotIn('plugin/notes.js', source)
            self.assertIn("127.0.0.1", archive.read('serve.py').decode())
            self.assertFalse(json.loads(archive.read('offline-manifest.json'))['networkRehearsalVerified'])
        first = self.output.read_bytes()
        offline.pack(self.root, self.output)
        self.assertEqual(self.output.read_bytes(), first)

    def test_unbundled_pdf_links_use_public_url(self):
        (self.deck / 'read.html').write_text('<html><a href="slides.pdf">PDF</a></html>')
        offline.pack(self.root, self.output)
        with zipfile.ZipFile(self.output) as archive:
            source = archive.read(f'talks/{talk()["slug"]}/read.html').decode()
            self.assertIn(f'href="https://slides.example.test/talks/{talk()["slug"]}/slides.pdf"', source)
            self.assertNotIn('href="slides.pdf"', source)

    def test_unknown_deck_does_not_replace_existing_archive(self):
        self.output.write_bytes(b'old archive')
        with self.assertRaisesRegex(ValueError, 'unknown decks'):
            offline.pack(self.root, self.output, {'missing'})
        self.assertEqual(self.output.read_bytes(), b'old archive')

    def test_missing_published_reference_preserves_archive(self):
        self.output.write_bytes(b'old archive')
        (self.deck / 'assets' / 'src' / 'snapshot.png').unlink()
        with self.assertRaisesRegex(ValueError, 'missing published img'):
            offline.pack(self.root, self.output)
        self.assertEqual(self.output.read_bytes(), b'old archive')


if __name__ == '__main__':
    unittest.main()
