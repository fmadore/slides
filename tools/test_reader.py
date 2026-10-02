"""Regression coverage for the public, static reading edition."""
import unittest
import tempfile
from html.parser import HTMLParser
from pathlib import Path

from slideslib.manifest import Talk
from slideslib.reader import render_reader


TALK = Talk("2026-01-02-reader", "2026-01-02", "en", "Event", "Venue",
            "Reading test", "Test", "Public summary", ("Author",))


def render(content, talk=TALK):
    source = f'<html><body><div class="reveal"><div class="slides">{content}</div></div></body></html>'
    return render_reader(source, talk, "https://slides.example.test")


class Scan(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class Reader(unittest.TestCase):
    def test_notes_private_hidden_slides_comments_and_scripts_are_not_published(self):
        page, count = render('''<section><h1>Public</h1><aside class="notes">Secret 1</aside>
          <p data-notes="Secret 2">Visible</p><div data-private>Secret 3</div>
          <script>const privateData = "Secret 4";</script><!-- Secret 5 -->
          <p hidden>Secret 6</p><div aria-hidden="true">Decoration</div></section>
          <section data-visibility="hidden"><h2>Secret 7</h2></section>''')
        self.assertEqual(count, 1)
        self.assertIn("Visible", page)
        self.assertNotIn("Secret", page)
        self.assertNotIn("Decoration", page)
        self.assertNotIn("<script", page)
        self.assertNotIn("data-notes", page)

    def test_images_figures_attribution_and_semantic_content_survive(self):
        page, _ = render('''<section><h2>Evidence</h2><figure>
          <img data-src="assets/source.png" width="900" height="600" alt="Archive page">
          <figcaption><a href="https://archive.test/item/1">Source: archive 1</a></figcaption></figure>
          <pre><code class="language-python">x = 1 &lt; 2</code></pre>
          <table><thead><tr><th scope="col">Count</th></tr></thead><tbody><tr><td>5</td></tr></tbody></table></section>''')
        self.assertIn('src="assets/source.png"', page)
        self.assertNotIn('data-src', page)
        self.assertIn('alt="Archive page"', page)
        self.assertIn('<a class="reader-image" href="assets/source.png">', page)
        self.assertIn('<figcaption><a href="https://archive.test/item/1">Source: archive 1</a></figcaption>', page)
        self.assertIn('<code class="language-python">x = 1 &lt; 2</code></pre>', page)
        self.assertIn('<pre tabindex="0" role="region" aria-label="Source text">', page)
        self.assertIn('class="reader-table" role="region" aria-label="Table" tabindex="0"', page)
        self.assertIn('<th scope="col">Count</th>', page)

    def test_live_content_becomes_link_and_authored_fallback_is_visible(self):
        page, _ = render('''<section><h2>Map</h2><div class="site-frame-view">
          <iframe data-src="https://maps.test/?a=1&amp;b=2" title="Research map"></iframe>
          <div class="frame-fallback" hidden><img src="assets/map.png" alt="Authored map screenshot"><button onclick="showLive()">Show live</button></div>
          </div></section>''')
        self.assertIn('href="https://maps.test/?a=1&amp;b=2"', page)
        self.assertIn('src="assets/map.png"', page)
        self.assertNotIn('<iframe', page)
        self.assertNotIn(' hidden', page)
        self.assertNotIn('<button', page)
        self.assertNotIn('onclick', page)

    def test_outline_one_h1_source_links_and_vertical_navigation(self):
        page, count = render('''<section id="cover"><h1>Cover</h1></section>
          <section><section><h2>First</h2></section><section><h2>Second</h2></section></section>
          <section data-visibility="uncounted"><p>Appendix</p></section>''')
        self.assertEqual(count, 4)
        self.assertEqual(sum(tag == "h1" for tag, _ in Scan(page).tags), 1)
        self.assertIn('href="index.html#/cover"', page)
        self.assertIn('href="index.html#/1/0"', page)
        self.assertIn('href="index.html#/1/1"', page)
        self.assertIn('href="../../index.html"', page)
        self.assertIn('id="slide-cover"', page)
        self.assertIn('id="slide-4-title"', page)
        self.assertIn('aria-labelledby="slide-4-title"', page)

    def test_scripts_styles_event_handlers_and_executable_urls_do_not_leak(self):
        page, _ = render('''<section style="height:720px"><h2>Test</h2>
          <img src="assets/test.png" style="width:4000px" onerror="secret()" alt="Test">
          <a href="javascript:secret()">Bad link</a><style>.x{display:none}</style></section>''')
        self.assertNotIn('style=', page)
        self.assertNotIn('onerror', page)
        self.assertNotIn('javascript:', page)
        self.assertNotIn('secret()', page)
        self.assertNotIn('<style', page)

    def test_anchors_are_unique_and_internal_content_links_are_preserved(self):
        page, _ = render('''<section id="first"><h2>First</h2><p id="ref">Reference</p>
          <a href="#ref">Cite</a><a href="#first">Start</a><a href="#/2">Reveal link</a></section>''')
        self.assertIn('id="slide-first--ref"', page)
        self.assertIn('href="#slide-first--ref"', page)
        self.assertIn('href="#slide-first"', page)
        self.assertIn('href="index.html#/2"', page)
        ids = [attrs["id"] for _, attrs in Scan(page).tags if "id" in attrs]
        self.assertEqual(len(ids), len(set(ids)))

    def test_no_slides_container_is_a_generation_error(self):
        with self.assertRaisesRegex(ValueError, "slides container"):
            render_reader('<html><p>Wrong file</p></html>', TALK, "https://slides.example.test")

    def test_runtime_text_assets_are_inlined_offline_and_cannot_read_private_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shared = root / "shared" / "assets"
            deck = root / "talks" / TALK.slug
            shared.mkdir(parents=True)
            deck.mkdir(parents=True)
            (shared / "extraction.md").write_text("Public extraction: <tag> & detail", encoding="utf-8")
            (shared / "with space.md").write_text("Public encoded filename", encoding="utf-8")
            private = root / "shared" / "src"
            private.mkdir()
            (private / "private.md").write_text("PRIVATE SOURCE", encoding="utf-8")
            (root / "private.md").write_text("PRIVATE FILE", encoding="utf-8")
            source = '<div class="slides"><section><h2>Extraction</h2><div data-skill-src="../../shared/assets/extraction.md"><pre>Loading…</pre></div></section></div>'
            page, _ = render_reader(source, TALK, "https://example.test", source_dir=deck, root_dir=root)
            self.assertIn("Public extraction: &lt;tag&gt; &amp; detail", page)
            self.assertNotIn("Loading", page)
            with self.assertRaisesRegex(ValueError, "public asset directories"):
                render_reader(source.replace("shared/assets/extraction", "private"), TALK,
                              "https://example.test", source_dir=deck, root_dir=root)
            with self.assertRaisesRegex(ValueError, "public asset directories"):
                render_reader(source.replace("shared/assets/extraction", "shared/src/private"), TALK,
                              "https://example.test", source_dir=deck, root_dir=root)
            page, _ = render_reader(source.replace("extraction.md", "with%20space.md").replace("data-skill-src", "data-embed-src"), TALK,
                                    "https://example.test", source_dir=deck, root_dir=root)
            self.assertIn("Public encoded filename", page)

    def test_a_heading_in_a_hidden_container_cannot_label_a_public_slide(self):
        page, _ = render('<section><div hidden><h2>PRIVATE HEADING</h2></div><p>Visible</p></section>')
        self.assertIn('id="slide-1-title"', page)
        self.assertNotIn("PRIVATE HEADING", page)

    def test_forward_links_target_normalized_later_heading_ids(self):
        page, _ = render('<section id="a"><h2>A</h2><a href="#future">Later</a></section><section id="b"><h2 id="future">B</h2></section>')
        self.assertIn('href="#slide-b-title"', page)
        self.assertIn('id="slide-b-title"', page)
        self.assertNotIn('slide-b--future', page)

    def test_existing_image_links_keep_their_destination_without_nested_anchors(self):
        page, _ = render('<section><h2>Source</h2><a href="https://archive.test"><img src="assets/a.png" alt="Document"></a></section>')
        self.assertIn('<a href="https://archive.test"><img', page)
        self.assertNotIn('class="reader-image"', page)


if __name__ == "__main__":
    unittest.main()
