#!/usr/bin/env python3
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from slideslib.deck_metadata import CONFIG_END, CONFIG_START, HEAD_END, HEAD_START, sync_deck_html
from slideslib.manifest import ManifestValidationError, load_manifest, manifest_text, parse_manifest


def talk(**changes):
    value = {
        "slug": "2026-01-02-demo-talk",
        "date": "2026-01-02",
        "language": "en",
        "event": "Demo event",
        "venue": "Demo venue",
        "title": "Landing title",
        "deckTitle": "Longer deck title",
        "shortTitle": "Demo",
        "description": "Description",
        "presenters": ["A. Author", "B. Author"],
        "tags": ["archives", "AI"],
    }
    value.update(changes)
    return value


class ManifestModel(unittest.TestCase):
    def test_round_trip_preserves_comment_optional_fields_and_deck_title(self):
        raw = {
            "$comment": "generated metadata",
            "site": "https://slides.example.test/",
            "talks": [{**talk(), "video": "https://example.test/video"}],
        }
        parsed = parse_manifest(raw)
        self.assertEqual(parsed.site, "https://slides.example.test")
        self.assertEqual(parsed.talks[0].display_title, "Longer deck title")
        self.assertEqual(json.loads(manifest_text(parsed)), raw | {"site": "https://slides.example.test"})

    def test_invalid_date_slug_language_and_order_are_reported_together(self):
        raw = {
            "site": "https://slides.example.test",
            "talks": [
                talk(slug="bad slug", date="not-a-date", language="english"),
                talk(slug="2025-01-01-earlier", date="2025-01-01"),
                talk(slug="2027-01-01-later", date="2027-01-01"),
            ],
        }
        with self.assertRaises(ManifestValidationError) as raised:
            parse_manifest(raw)
        message = str(raised.exception)
        self.assertIn("dated lowercase hyphenated", message)
        self.assertIn("valid YYYY-MM-DD", message)
        self.assertIn("two-letter code", message)
        self.assertIn("newest first", message)

    def test_load_manifest_wraps_malformed_json(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "talks.json"
            path.write_text("{bad", encoding="utf-8")
            with self.assertRaisesRegex(ManifestValidationError, "unreadable manifest"):
                load_manifest(path)


class GeneratedDeckMetadata(unittest.TestCase):
    TEMPLATE = f'''<!doctype html>
<html lang="fr"><head>
{HEAD_START}
  <title>old</title>
{HEAD_END}
</head><body><script>
  window.DECK_CONFIG = {{
{CONFIG_START}
    presenter: "old",
{CONFIG_END}
    transition: "fade",
  }};
</script></body></html>
'''

    def test_sync_is_idempotent_and_escapes_html_and_script_boundaries(self):
        model = parse_manifest({
            "site": "https://slides.example.test",
            "talks": [talk(title='Research & "archives" </script>')],
        }).talks[0]
        once = sync_deck_html(self.TEMPLATE, model, "https://slides.example.test")
        twice = sync_deck_html(once, model, "https://slides.example.test")
        self.assertEqual(once, twice)
        self.assertIn('Research &amp; &quot;archives&quot; &lt;/script&gt;', once)
        self.assertIn("<\\/script>", once)
        self.assertIn('talkTitle: "Longer deck title"', once)

    def test_incomplete_markers_are_rejected(self):
        model = parse_manifest({"site": "https://slides.example.test", "talks": [talk()]}).talks[0]
        with self.assertRaisesRegex(ValueError, "markers missing"):
            sync_deck_html(self.TEMPLATE.replace(HEAD_END, ""), model, "https://slides.example.test")


if __name__ == "__main__":
    unittest.main(verbosity=2)
