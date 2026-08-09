#!/usr/bin/env python3
import contextlib
import importlib.util
import io
import json
import subprocess
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
