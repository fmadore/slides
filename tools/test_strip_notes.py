#!/usr/bin/env python3
"""Tests for tools/strip-notes.py — run with:  python3 tools/test_strip_notes.py"""
import importlib.util
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("strip_notes", os.path.join(HERE, "strip-notes.py"))
strip_notes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(strip_notes)


def strip(html):
    counts = {"aside": 0, "attr": 0, "note": 0, "plugin": 0}
    return strip_notes.strip_notes(html, counts), counts


class StripHtmlNotes(unittest.TestCase):
    def test_plain_double_quotes(self):
        out, c = strip('<p>x</p><aside class="notes">secret</aside><p>y</p>')
        self.assertNotIn("secret", out)
        self.assertEqual(c["aside"], 1)

    def test_multiple_classes_either_side(self):
        for cls in ("notes wide", "wide notes", "a notes b"):
            out, c = strip(f'<aside class="{cls}">secret</aside>')
            self.assertNotIn("secret", out, cls)
            self.assertEqual(c["aside"], 1, cls)

    def test_single_quotes(self):
        out, c = strip("<aside class='notes'>secret</aside>")
        self.assertNotIn("secret", out)
        self.assertEqual(c["aside"], 1)

    def test_uppercase_markup(self):
        out, c = strip('<ASIDE CLASS="NOTES">secret</ASIDE>')
        self.assertNotIn("secret", out)
        self.assertEqual(c["aside"], 1)

    def test_multiline_attributes(self):
        html = '<aside\n    data-x="1"\n    class="notes"\n>multi\nline secret</aside>'
        out, c = strip(html)
        self.assertNotIn("secret", out)
        self.assertEqual(c["aside"], 1)

    def test_attribute_after_class(self):
        out, c = strip('<aside class="notes" data-markdown>secret</aside>')
        self.assertNotIn("secret", out)
        self.assertEqual(c["aside"], 1)

    def test_does_not_eat_non_note_asides(self):
        html = '<aside class="notesque">keep</aside><aside class="sidebar">keep2</aside>'
        out, c = strip(html)
        self.assertIn("keep", out)
        self.assertIn("keep2", out)
        self.assertEqual(c["aside"], 0)

    def test_data_notes_attribute(self):
        out, c = strip('<section class="cover" data-notes="secret">slide</section>')
        self.assertNotIn("secret", out)
        self.assertEqual(out, '<section class="cover">slide</section>')
        self.assertEqual(c["attr"], 1)

    def test_data_notes_quoting_variants(self):
        cases = ("<section data-notes='secret'>x</section>",
                 '<SECTION DATA-NOTES="secret">x</SECTION>',
                 '<section data-notes = "secret">x</section>',
                 '<section data-notes="multi\nline secret">x</section>',
                 "<section data-notes=secret>x</section>")
        for html in cases:
            out, c = strip(html)
            self.assertNotIn("secret", out, html)
            self.assertEqual(c["attr"], 1, html)

    def test_does_not_eat_other_data_attributes(self):
        html = '<section data-toc="Intro" data-notes-visible="1" data-note="keep">x</section>'
        out, c = strip(html)
        self.assertEqual(out, html)
        self.assertEqual(c["attr"], 0)

    def test_markdown_note_block(self):
        html = "<textarea data-template>\n## Slide\n\nNote:\nsecret cue</textarea>"
        out, c = strip(html)
        self.assertNotIn("secret cue", out)
        self.assertEqual(c["note"], 1)

    def test_notes_plugin_script_removed(self):
        html = '<script src="../../shared/reveal/plugin/notes.js"></script>\n<script src="x.js"></script>'
        out, c = strip(html)
        self.assertNotIn("notes.js", out)
        self.assertIn("x.js", out)
        self.assertEqual(c["plugin"], 1)


class BuildTree(unittest.TestCase):
    def make_repo(self, tmp):
        src = os.path.join(tmp, "repo")
        for d in ("shared/src/theme", "talks/2026-01-01-demo/assets", "talks/_template", "tools", ".github", ".impeccable"):
            os.makedirs(os.path.join(src, d), exist_ok=True)
        deck = ('<html><body><section data-notes="attribute secret">slide</section>'
                '<aside class="notes">secret</aside>'
                '<script src="../../shared/reveal/plugin/notes.js"></script></body></html>')
        writes = {
            "index.html": "<html>landing</html>",
            "CNAME": "example.com",
            ".nojekyll": "",
            "README.md": "dev docs",
            ".gitignore": "x",
            ".gitattributes": "x",
            "PRODUCT.md": "product truth",
            "DESIGN.md": "design system",
            ".impeccable/config.json": "{}",
            "serve-deck.py": "print()",
            "shared/theme.css": "css",
            "shared/src/theme/01.css": "source css",
            "shared/vendor-manifest.json": "{}",
            "shared/notes.js": "plugin",
            "talks/2026-01-01-demo/index.html": deck,
            "talks/_template/index.html": "<html>template</html>",
            "tools/strip-notes.py": "tool",
        }
        for rel, content in writes.items():
            with open(os.path.join(src, rel), "w") as fh:
                fh.write(content)
        return src

    def test_allowlist_and_strip(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = self.make_repo(tmp)
            dest = os.path.join(tmp, "_site")
            counts = strip_notes.build(src, dest)
            # published
            for keep in ("index.html", "CNAME", ".nojekyll", "shared/theme.css",
                         "talks/2026-01-01-demo/index.html"):
                self.assertTrue(os.path.exists(os.path.join(dest, keep)), keep)
            # excluded
            for gone in ("README.md", ".gitignore", ".gitattributes", "PRODUCT.md",
                         "DESIGN.md", ".impeccable",
                         "serve-deck.py", "tools", ".github", "talks/_template",
                         "shared/notes.js", "shared/src", "shared/vendor-manifest.json"):
                self.assertFalse(os.path.exists(os.path.join(dest, gone)), gone)
            with open(os.path.join(dest, "talks/2026-01-01-demo/index.html")) as fh:
                html = fh.read()
            self.assertNotIn("secret", html)
            self.assertNotIn("data-notes", html)
            self.assertNotIn("notes.js", html)
            self.assertEqual(counts["aside"], 1)
            self.assertEqual(counts["attr"], 1)
            self.assertEqual(counts["plugin"], 1)

    def test_assertion_catches_a_surviving_data_notes(self):
        # The post-build scan is the safety net: if stripping ever regressed,
        # the build must fail rather than publish the note. Disable stripping
        # and build a deck whose only note is the attribute form.
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "repo")
            os.makedirs(os.path.join(src, "talks", "2026-01-01-demo"))
            with open(os.path.join(src, "talks", "2026-01-01-demo", "index.html"), "w") as fh:
                fh.write('<html><body><section data-notes="secret">x</section></body></html>')
            unstripped, strip_notes.strip_notes = strip_notes.strip_notes, lambda html, counts: html
            try:
                with self.assertRaises(SystemExit) as caught:
                    strip_notes.build(src, os.path.join(tmp, "_site"))
            finally:
                strip_notes.strip_notes = unstripped
            self.assertIn("index.html", str(caught.exception))

    def test_counts_reset_between_builds(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = self.make_repo(tmp)
            c1 = strip_notes.build(src, os.path.join(tmp, "a"))
            c2 = strip_notes.build(src, os.path.join(tmp, "b"))
            self.assertEqual(c1, c2)

    def test_refuses_source_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = self.make_repo(tmp)
            with self.assertRaises(SystemExit):
                strip_notes.build(src, src)

    def test_refuses_ancestor_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = self.make_repo(tmp)
            with self.assertRaises(SystemExit):
                strip_notes.build(src, tmp)  # tmp contains src


if __name__ == "__main__":
    unittest.main(verbosity=2)
