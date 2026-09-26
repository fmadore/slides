#!/usr/bin/env python3
"""Tests for tools/build-index.py — the landing page's talk list and sitemap.

The landing page is where a reader arrives, and every row on it is generated
from talks/talks.json: these pin the escaping, what the client-side search can
find, the outline the list sits in, and the --check gate CI runs.
"""
import contextlib
import importlib.util
import io
import json
import os
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("build_index", os.path.join(HERE, "build-index.py"))
build_index = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_index)


def talk(**changes):
    value = {
        "slug": "2026-03-04-demo-talk",
        "date": "2026-03-04",
        "language": "fr",
        "event": "Colloque · Ville",
        "venue": "Salle des actes · Ville · 4 mars 2026",
        "title": "Un titre",
        "shortTitle": "Titre",
        "description": "Une description.",
        "presenters": ["A. Author", "Frédérick Madore"],
        "tags": ["OCR", "archives"],
    }
    value.update(changes)
    return value


class RenderTalk(unittest.TestCase):
    def test_author_strings_are_escaped_everywhere_they_land(self):
        row = build_index.render_talk(talk(title='A <b>"bold"</b> & claim',
                                           event="Event </script>",
                                           description="It's <i>here</i>"))
        self.assertIn('A &lt;b&gt;&quot;bold&quot;&lt;/b&gt; &amp; claim', row)
        self.assertIn("Event &lt;/script&gt;", row)
        self.assertIn("It&#x27;s &lt;i&gt;here&lt;/i&gt;", row)
        self.assertNotIn("<b>", row)
        self.assertNotIn("<i>", row)

    def test_search_index_covers_what_a_reader_remembers_a_talk_by(self):
        row = build_index.render_talk(talk(deckTitle="Un titre plus long : sous-titre"))
        search = row.split('data-search="', 1)[1].split('"', 1)[0]
        for needle in ("un titre", "sous-titre", "colloque", "salle des actes",
                       "une description", "a. author", "ocr", "archives"):
            self.assertIn(needle, search)
        self.assertEqual(search, search.lower())

    def test_extras_link_the_reader_view_pdf_and_optional_media(self):
        plain = build_index.render_talk(talk())
        self.assertIn('href="talks/2026-03-04-demo-talk/?view=scroll&amp;scrollLayout=compact">Read', plain)
        self.assertIn('href="talks/2026-03-04-demo-talk/slides.pdf">PDF', plain)
        self.assertNotIn(">Video<", plain)
        self.assertNotIn(">Event<", plain)
        rich = build_index.render_talk(talk(pdf="files/demo.pdf", video="https://video.example.test/v",
                                            eventUrl="https://event.example.test/"))
        self.assertIn('href="files/demo.pdf">PDF', rich)
        self.assertIn('href="https://video.example.test/v" target="_blank" rel="noopener">Video', rich)
        self.assertIn('href="https://event.example.test/" target="_blank" rel="noopener">Event', rich)

    def test_filter_attributes_carry_language_year_and_tags(self):
        row = build_index.render_talk(talk())
        self.assertIn('data-lang="fr"', row)
        self.assertIn('data-year="2026"', row)
        self.assertIn('data-tags="OCR|archives"', row)
        self.assertIn('title="Français">FR<', row)
        self.assertIn("04 Mar 2026", row)


class BuildBlock(unittest.TestCase):
    def test_list_sits_under_an_h2_so_the_outline_skips_no_level(self):
        block = build_index.build_block({"talks": [talk()]})
        self.assertIn('<h2 class="label">The talks</h2>', block)
        self.assertIn('<h3 class="talk-title">', block)

    def test_talks_are_newest_first_and_counted(self):
        block = build_index.build_block({"talks": [
            talk(slug="2025-01-01-older", date="2025-01-01"),
            talk(slug="2026-05-05-newer", date="2026-05-05"),
        ]})
        self.assertLess(block.index("2026-05-05-newer"), block.index("2025-01-01-older"))
        self.assertIn('data-total="2">02 talks<', block)
        self.assertIn('data-total="1">01 talk<', build_index.build_block({"talks": [talk()]}))

    def test_no_unread_data_island_is_shipped(self):
        """The filters read each row's data-* attributes; a JSON copy of the
        manifest had no reader and only doubled the payload."""
        self.assertNotIn("application/json", build_index.build_block({"talks": [talk()]}))


class Sitemap(unittest.TestCase):
    def test_landing_page_lastmod_is_the_newest_talk(self):
        sitemap = build_index.build_sitemap({
            "site": "https://slides.example.test/",
            "talks": [talk(slug="2025-01-01-older", date="2025-01-01"),
                      talk(slug="2026-05-05-newer", date="2026-05-05")],
        })
        self.assertIn("<url><loc>https://slides.example.test/</loc><lastmod>2026-05-05</lastmod></url>", sitemap)
        self.assertIn("<loc>https://slides.example.test/talks/2025-01-01-older/</loc>"
                      "<lastmod>2025-01-01</lastmod>", sitemap)
        self.assertTrue(sitemap.startswith('<?xml version="1.0" encoding="UTF-8"?>'))

    def test_an_empty_manifest_still_lists_the_landing_page(self):
        sitemap = build_index.build_sitemap({"site": "https://slides.example.test", "talks": []})
        self.assertIn("<url><loc>https://slides.example.test/</loc></url>", sitemap)


class CheckMode(unittest.TestCase):
    """main(): the --check gate CI runs, against a throwaway repository."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        root = self._tmp.name
        os.makedirs(os.path.join(root, "talks"))
        self.manifest = os.path.join(root, "talks", "talks.json")
        self.index = os.path.join(root, "index.html")
        with open(self.index, "w", encoding="utf-8") as handle:
            handle.write(f"<html><body>{build_index.START}\n{build_index.END}</body></html>")
        self.write_manifest([talk()])
        self._saved = (build_index.ROOT, build_index.INDEX, build_index.MANIFEST)
        build_index.ROOT, build_index.INDEX, build_index.MANIFEST = root, self.index, self.manifest

    def tearDown(self):
        build_index.ROOT, build_index.INDEX, build_index.MANIFEST = self._saved
        self._tmp.cleanup()

    def write_manifest(self, talks):
        with open(self.manifest, "w", encoding="utf-8") as handle:
            json.dump({"site": "https://slides.example.test", "talks": talks}, handle)

    @staticmethod
    def run_main(argv):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            return build_index.main(argv), out.getvalue()

    def test_stale_page_fails_check_until_regenerated(self):
        status, out = self.run_main(["--check"])
        self.assertEqual(status, 1)
        self.assertIn("OUT OF DATE", out)
        self.assertEqual(self.run_main([])[0], 0)
        self.assertEqual(self.run_main(["--check"])[0], 0)
        self.write_manifest([talk(title="A new title")])
        self.assertEqual(self.run_main(["--check"])[0], 1)

    def test_invalid_manifest_is_reported_not_rendered(self):
        self.write_manifest([talk(date="not-a-date")])
        status, out = self.run_main([])
        self.assertEqual(status, 2)
        self.assertIn("valid YYYY-MM-DD", out)
        with open(self.index, encoding="utf-8") as handle:
            self.assertNotIn("talk-row", handle.read())


if __name__ == "__main__":
    unittest.main(verbosity=2)
