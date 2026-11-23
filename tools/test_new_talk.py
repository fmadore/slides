#!/usr/bin/env python3
import contextlib
import importlib.util
import io
import json
import subprocess
import shutil
import builtins
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("new_talk", HERE / "new-talk.py")
new_talk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(new_talk)


TEMPLATE = '''<!doctype html>
<html lang="en"><head>
  <!-- DECK_META:START (generated from talks/talks.json) -->
  <title>Talk title — Frédérick Madore</title>
  <meta name="description" content="A one-line description of the talk.">
  <!-- DECK_META:END -->
</head><body>
<script>window.DECK_CONFIG = {
    // DECK_CONFIG_META:START (generated from talks/talks.json)
    presenter: "Frédérick Madore",
    talkTitle: "Talk title",
    talkShort: "Talk title",
    venue: "Venue · DD Month YYYY",
    tocEyebrow: "Outline",
    // DECK_CONFIG_META:END
    transition: "fade",
};</script>
<section><p class="eyebrow">Event · Place, DD Month YYYY</p><h1>Talk title</h1>
<p class="subtitle">A one-line description of the talk.</p>
      <div class="byline">
        <span class="name">Frédérick Madore</span></div>
<!-- QR --><div class="slides-qr"><img src="assets/qr-slides.png" alt="QR"></div>
</section></body></html>
'''


class NewTalkTransaction(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.template = self.root / "talks" / "_template"
        (self.template / "assets").mkdir(parents=True)
        (self.template / "index.html").write_text(TEMPLATE, encoding="utf-8")
        (self.template / "assets" / "qr-slides.png").write_bytes(b"placeholder")
        self.manifest = self.root / "talks" / "talks.json"
        self.manifest.write_text(json.dumps({
            "site": "https://slides.example.test",
            "talks": [],
        }), encoding="utf-8")
        (self.root / "index.html").write_text("landing-before", encoding="utf-8")
        (self.root / "sitemap.xml").write_text("sitemap-before", encoding="utf-8")
        self.globals = patch.multiple(
            new_talk,
            ROOT=self.root,
            TEMPLATE=self.template,
            MANIFEST=self.manifest,
        )
        self.globals.start()

    def tearDown(self):
        self.globals.stop()
        self.temporary.cleanup()

    @staticmethod
    def args(*extra):
        return [
            "--date", "2099-03-04", "--place", "Test City",
            "--title", "Archives & <AI>", "--event", "Event & Lab",
            "--desc", "Safe <description>", "--no-qr", *extra,
        ]

    def test_dry_run_changes_nothing(self):
        before = self.manifest.read_text(encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(new_talk.main(self.args("--dry-run")), 0)
        self.assertEqual(self.manifest.read_text(encoding="utf-8"), before)
        self.assertFalse((self.root / "talks" / "2099-03-04-test-city-archives-ai").exists())

    def test_success_registers_escaped_deck_and_removes_qr(self):
        with patch.object(new_talk.subprocess, "run") as run, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(new_talk.main(self.args()), 0)
        run.assert_called_once()
        deck = self.root / "talks" / "2099-03-04-test-city-archives-ai" / "index.html"
        source = deck.read_text(encoding="utf-8")
        self.assertIn("Archives &amp; &lt;AI&gt;", source)
        self.assertIn("Safe &lt;description&gt;", source)
        self.assertNotIn("slides-qr", source)
        manifest = json.loads(self.manifest.read_text(encoding="utf-8"))
        self.assertEqual(manifest["talks"][0]["slug"], "2099-03-04-test-city-archives-ai")

    def test_build_failure_rolls_back_every_repository_change(self):
        before = {path: path.read_text(encoding="utf-8") for path in (
            self.manifest, self.root / "index.html", self.root / "sitemap.xml",
        )}
        failure = subprocess.CalledProcessError(1, "build-index")
        with patch.object(new_talk.subprocess, "run", side_effect=failure), \
                contextlib.redirect_stdout(io.StringIO()), self.assertRaises(subprocess.CalledProcessError):
            new_talk.main(self.args())
        for path, expected in before.items():
            self.assertEqual(path.read_text(encoding="utf-8"), expected)
        self.assertFalse((self.root / "talks" / "2099-03-04-test-city-archives-ai").exists())

    def test_real_qr_scaffold_and_regeneration_decodes_canonical_url(self):
        import zxingcpp
        from PIL import Image
        # Run the real generator and real landing-page subprocess against an
        # isolated copy of the current authoring template and tools.
        shutil.copytree(HERE / "slideslib", self.root / "tools" / "slideslib", ignore=shutil.ignore_patterns('__pycache__'))
        shutil.copy2(HERE / "build-index.py", self.root / "tools" / "build-index.py")
        shutil.copy2(HERE.parent / "talks" / "_template" / "index.html", self.template / "index.html")
        shutil.copy2(HERE.parent / "index.html", self.root / "index.html")
        args = [value for value in self.args() if value != '--no-qr']
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(new_talk.main(args), 0)
        deck = self.root / 'talks' / '2099-03-04-test-city-archives-ai'
        with Image.open(deck / 'assets' / 'qr-slides.png') as picture:
            barcode = zxingcpp.read_barcode(picture)
        self.assertIsNotNone(barcode)
        self.assertEqual(barcode.text, 'https://slides.example.test/talks/2099-03-04-test-city-archives-ai/')
        self.assertIn('2099-03-04-test-city-archives-ai', (self.root / 'index.html').read_text())
        self.assertIn('2099-03-04-test-city-archives-ai', (self.root / 'sitemap.xml').read_text())
        self.assertTrue((deck / 'read.html').is_file())

    def test_zmo_brand_scaffolds_from_the_zmo_starter(self):
        # The real ZMO starter must carry every cover string new-talk fills,
        # and the real index build must keep the brand switch on <body>.
        shutil.copytree(HERE / "slideslib", self.root / "tools" / "slideslib", ignore=shutil.ignore_patterns('__pycache__'))
        shutil.copy2(HERE / "build-index.py", self.root / "tools" / "build-index.py")
        shutil.copytree(HERE.parent / "talks" / "_template-zmo", self.root / "talks" / "_template-zmo")
        shutil.copy2(HERE.parent / "index.html", self.root / "index.html")
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(new_talk.main(self.args("--brand", "zmo")), 0)
        deck = self.root / 'talks' / '2099-03-04-test-city-archives-ai'
        source = (deck / 'index.html').read_text(encoding="utf-8")
        self.assertIn('<body data-brand="zmo">', source)
        self.assertIn('shared/brands/zmo/zmo.css', source)
        self.assertIn('<h1>Archives &amp; &lt;AI&gt;</h1>', source)
        self.assertIn('<p class="eyebrow">Event &amp; Lab · 4 March 2099</p>', source)
        self.assertNotIn('Talk title</h1>', source)
        self.assertNotIn('slides-qr', source)
        self.assertTrue((deck / 'read.html').is_file())

    def scaffold_and_audit(self, *extra):
        """Scaffold from the real starter, then run the deck audits on it.

        The temporary root has no shared/ engine, so references into it are
        the one thing left out; everything the deck itself carries is held to
        the same checks as a published talk (#30).
        """
        shutil.copytree(HERE / "slideslib", self.root / "tools" / "slideslib", ignore=shutil.ignore_patterns('__pycache__'))
        shutil.copy2(HERE / "build-index.py", self.root / "tools" / "build-index.py")
        shutil.copy2(HERE.parent / "talks" / "_template" / "index.html", self.template / "index.html")
        shutil.copytree(HERE.parent / "talks" / "_template-zmo", self.root / "talks" / "_template-zmo")
        shutil.copy2(HERE.parent / "index.html", self.root / "index.html")
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(new_talk.main(self.args(*extra)), 0)
        deck = self.root / 'talks' / '2099-03-04-test-city-archives-ai'
        audit_spec = importlib.util.spec_from_file_location("audit_for_new_talk", HERE / "audit.py")
        audit = importlib.util.module_from_spec(audit_spec)
        audit_spec.loader.exec_module(audit)
        audit.ROOT = str(self.root)
        rep = audit.Report()
        audit.audit_html(str(deck / "index.html"), rep, published_deck=True)
        audit.audit_deck_css(str(deck / "index.html"), rep)
        audit.audit_placeholder_qr(rep, [deck.name])
        errors = [msg for _, msg in rep.errors if "../../shared/" not in msg]
        return deck, errors, output.getvalue()

    def test_no_qr_scaffold_passes_the_deck_audit_for_every_brand(self):
        for brand in ("bayreuth", "zmo"):
            with self.subTest(brand):
                deck, errors, _ = self.scaffold_and_audit("--brand", brand)
                self.assertEqual(errors, [])
                self.assertFalse((deck / "assets" / "qr-slides.png").exists())
                self.assertNotIn("slides-qr", (deck / "index.html").read_text(encoding="utf-8"))
                shutil.rmtree(deck)
                self.manifest.write_text(json.dumps({"site": "https://slides.example.test",
                                                     "talks": []}), encoding="utf-8")
                shutil.rmtree(self.root / "talks" / "_template-zmo")
                shutil.rmtree(self.root / "tools")

    def test_zmo_card_qr_examples_keep_their_own_placeholder(self):
        deck, _, _ = self.scaffold_and_audit("--brand", "zmo")
        source = (deck / "index.html").read_text(encoding="utf-8")
        self.assertEqual(source.count('src="assets/qr-example.png"'), 2)
        self.assertTrue((deck / "assets" / "qr-example.png").is_file())

    def test_next_steps_name_the_one_validation_command(self):
        _, _, output = self.scaffold_and_audit()
        self.assertIn("Validate: npm run validate", output)
        self.assertNotIn("npm test &&", output)

    def test_unknown_brand_is_refused(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            new_talk.main(self.args("--brand", "nowhere"))

    def test_qr_failure_leaves_no_registration_or_partial_deck(self):
        before = self.manifest.read_bytes()
        args = [value for value in self.args() if value != '--no-qr']
        with patch.object(new_talk, 'write_qr', side_effect=OSError('image write failed')), self.assertRaises(OSError):
            new_talk.main(args)
        self.assertEqual(self.manifest.read_bytes(), before)
        self.assertFalse((self.root / 'talks' / '2099-03-04-test-city-archives-ai').exists())

    def test_missing_qr_dependency_fails_before_mutation(self):
        before = self.manifest.read_bytes()
        original_import = builtins.__import__
        def without_qrcode(name, *args, **kwargs):
            if name == 'qrcode':
                raise ImportError('not installed')
            return original_import(name, *args, **kwargs)
        with patch('builtins.__import__', side_effect=without_qrcode), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            new_talk.main([value for value in self.args() if value != '--no-qr'])
        self.assertEqual(self.manifest.read_bytes(), before)
        self.assertFalse((self.root / 'talks' / '2099-03-04-test-city-archives-ai').exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
