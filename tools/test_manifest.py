#!/usr/bin/env python3
import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from slideslib.deck_metadata import (CONFIG_END, CONFIG_START, HEAD_END, HEAD_START, OWNER,
                                    render_head, sync_deck_html)
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


class CitationMetadata(unittest.TestCase):
    """What a citation manager reads: Zotero's connector and Google Scholar
    take the Highwire citation_* tags, search engines the JSON-LD block."""
    SITE = "https://slides.example.test"

    def head(self, **changes):
        model = parse_manifest({"site": self.SITE, "talks": [talk(**changes)]}).talks[0]
        return render_head(model, self.SITE)

    @staticmethod
    def meta(head, name):
        return re.findall(rf'<meta name="{name}" content="([^"]*)">', head)

    @staticmethod
    def structured(head):
        start = head.index('<script type="application/ld+json">') + len('<script type="application/ld+json">')
        return json.loads(head[start:head.index("</script>", start)].replace("<\\/", "</"))

    def test_highwire_tags_describe_the_talk_as_a_conference_paper(self):
        head = self.head()
        self.assertEqual(self.meta(head, "citation_title"), ["Longer deck title"])
        self.assertEqual(self.meta(head, "citation_author"), ["A. Author", "B. Author"])
        self.assertEqual(self.meta(head, "citation_publication_date"), ["2026/01/02"])
        # Without this tag Zotero guesses "journal article" from citation_title.
        self.assertEqual(self.meta(head, "citation_conference_title"), ["Demo event"])
        self.assertEqual(self.meta(head, "citation_language"), ["en"])
        self.assertEqual(self.meta(head, "citation_keywords"), ["archives", "AI"])
        self.assertEqual(self.meta(head, "citation_pdf_url"),
                         [f"{self.SITE}/talks/2026-01-02-demo-talk/slides.pdf"])

    def test_pdf_override_resolves_like_the_landing_page_link(self):
        relative = self.head(pdf="files/demo.pdf")
        self.assertEqual(self.meta(relative, "citation_pdf_url"), [f"{self.SITE}/files/demo.pdf"])
        absolute = self.head(pdf="https://repository.example.test/demo.pdf")
        self.assertEqual(self.meta(absolute, "citation_pdf_url"), ["https://repository.example.test/demo.pdf"])
        self.assertEqual(self.structured(absolute)["encoding"]["contentUrl"],
                         "https://repository.example.test/demo.pdf")

    def test_citation_values_are_escaped(self):
        head = self.head(deckTitle='Archives & "AI" <b>', event="Event </script>", tags=['a"b'])
        self.assertEqual(self.meta(head, "citation_title"), ["Archives &amp; &quot;AI&quot; &lt;b&gt;"])
        self.assertEqual(self.meta(head, "citation_conference_title"), ["Event &lt;/script&gt;"])
        self.assertEqual(self.meta(head, "citation_keywords"), ["a&quot;b"])

    def test_owner_carries_identifiers_and_co_presenters_only_their_names(self):
        data = self.structured(self.head(presenters=["A. Author", OWNER["name"]]))
        coauthor, owner = data["author"]
        self.assertEqual(coauthor, {"@type": "Person", "name": "A. Author"})
        self.assertEqual(owner["sameAs"], OWNER["orcid"])
        self.assertEqual(data["publisher"]["sameAs"], OWNER["orcid"])
        self.assertTrue(data["image"].endswith("/talks/2026-01-02-demo-talk/social-card.png"))

    def test_event_link_and_card_alt_follow_the_manifest(self):
        data = self.structured(self.head(eventUrl="https://event.example.test/"))
        self.assertEqual(data["releasedEvent"]["url"], "https://event.example.test/")
        self.assertNotIn("url", self.structured(self.head())["releasedEvent"])
        self.assertIn('og:image:alt" content="Cover slide: Longer deck title"', self.head())
        self.assertIn('og:image:alt" content="Diapositive de couverture : Longer deck title"',
                      self.head(language="fr"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
