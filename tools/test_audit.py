#!/usr/bin/env python3
"""Tests for tools/audit.py — run with:  python3 tools/test_audit.py

Every audit rule gets a test that makes it fire and, where the distinction
matters, a companion test proving it stays quiet on valid markup. The point
is not to re-check the repository (audit.py does that on real content) but to
catch a rule that silently stops matching: without these, a broken regex or a
renamed attribute would leave CI green while the check quietly does nothing.

Each test builds a throwaway repository under a temp dir and points
audit.ROOT at it, so nothing here touches the real tree.
"""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("audit", os.path.join(HERE, "audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


TALK = {
    "slug": "2026-01-01-demo",
    "date": "2026-01-01",
    "language": "en",
    "event": "Demo Conference",
    "venue": "Somewhere",
    "title": "A demonstration talk",
    "shortTitle": "Demo",
    "description": "A talk used by the tests.",
    "presenters": ["Frédérick Madore"],
}


class AuditCase(unittest.TestCase):
    """Base: build a fixture repo, point audit.ROOT at it, restore afterwards."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = os.path.join(self._tmp.name, "repo")
        self._real_root = audit.ROOT
        audit.ROOT = self.root
        self.rep = audit.Report()

    def tearDown(self):
        audit.ROOT = self._real_root
        self._tmp.cleanup()

    # -- fixture helpers ---------------------------------------------------
    def write(self, rel, content, root=None):
        path = os.path.join(root or self.root, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if isinstance(content, bytes):
            with open(path, "wb") as fh:
                fh.write(content)
        else:
            # newline="" keeps \n verbatim on Windows: the repository stores LF
            # (see .gitattributes) and the checksum tests hash what they wrote.
            with open(path, "w", encoding="utf-8", newline="") as fh:
                fh.write(content)
        return path

    def make_repo(self, talks=(TALK,), landing=None):
        """A minimal repo that audits clean, ready to be broken per test."""
        slugs = [t["slug"] for t in talks]
        self.write("talks/talks.json", json.dumps({
            "site": "https://slides.example.test",
            "talks": list(talks),
        }))
        for slug in slugs:
            self.write(f"talks/{slug}/index.html", "<html><body>deck</body></html>")
        if landing is None:
            landing = "<html><body>" + "".join(
                f'<a href="talks/{s}/">{s}</a>' for s in slugs) + "</body></html>"
        self.write("index.html", landing)
        return self.root

    # -- assertions --------------------------------------------------------
    def messages(self, kind="errors"):
        return [msg for _, msg in getattr(self.rep, kind)]

    def assertReports(self, needle, kind="errors"):
        found = self.messages(kind)
        self.assertTrue(any(needle in m for m in found),
                        f"expected {kind[:-1]} matching {needle!r}, got {found}")

    def assertSilent(self, kind="errors"):
        self.assertEqual(self.messages(kind), [])


class HtmlChecks(AuditCase):
    """audit_html: references, ids, accessibility attributes, placeholders."""

    def audit(self, html, published_deck=True, rel="talks/2026-01-01-demo/index.html"):
        path = self.write(rel, html)
        audit.audit_html(path, self.rep, published_deck=published_deck)

    def test_missing_local_image(self):
        self.audit('<img src="assets/nope.png" alt="x">')
        self.assertReports("missing local img: assets/nope.png")

    def test_present_local_image_is_silent(self):
        self.write("talks/2026-01-01-demo/assets/there.png", b"\x89PNG")
        self.audit('<img src="assets/there.png" alt="x">')
        self.assertSilent()

    def test_missing_local_script_stylesheet_and_iframe(self):
        self.audit('<script src="../../shared/gone.js"></script>'
                   '<link href="../../shared/gone.css" rel="stylesheet">'
                   '<iframe src="embed/gone.html" title="An embed"></iframe>')
        self.assertReports("missing local script:")
        self.assertReports("missing local link:")
        self.assertReports("missing local iframe:")

    def test_missing_srcset_video_poster_and_object_references(self):
        self.audit('<img srcset="one.png 1x, two.png 2x" alt="x">'
                   '<video poster="poster.jpg"></video><object data="file.pdf"></object>')
        for reference in ("one.png", "two.png", "poster.jpg", "file.pdf"):
            self.assertReports(reference)

    def test_missing_inline_css_url(self):
        self.audit('<style>.cover{background:url("assets/missing.jpg")}</style>')
        self.assertReports("missing local inline CSS reference")

    def test_missing_data_embed_sources(self):
        self.audit('<div data-skill-src="a.md"></div><div data-embed-src="b.md"></div>')
        self.assertReports("missing local embed: a.md")
        self.assertReports("missing local embed: b.md")

    def test_root_absolute_reference_resolves_against_repo_root(self):
        self.write("shared/logo.svg", "<svg/>")
        self.audit('<img src="/shared/logo.svg" alt="logo">')
        self.assertSilent()
        self.audit('<img src="/shared/absent.svg" alt="logo">')
        self.assertReports("missing local img: /shared/absent.svg")

    def test_local_reference_cannot_escape_repository(self):
        self.audit('<img src="../../../../outside.png" alt="x">')
        self.assertReports("escapes the repository")

    def test_remote_and_anchor_references_are_not_checked(self):
        self.audit('<img src="https://example.org/a.png" alt="x">'
                   '<a href="#next">next</a><a href="mailto:x@example.org">mail</a>'
                   '<img src="data:image/gif;base64,R0lGOD" alt="y">')
        self.assertSilent()

    def test_build_generated_downloads_are_exempt(self):
        self.audit('<a href="slides.pdf">PDF</a><a href="social-card.png">card</a>')
        self.assertSilent()

    def test_malformed_url_does_not_crash_the_audit(self):
        """urlparse raises on an unclosed IPv6 literal; the audit must not.
        Reporting the typo is tools/check-links.py's job, not this one's."""
        self.audit('<a href="http://[bad">typo</a><img src="http://[bad" alt="x">')
        self.assertSilent()

    def test_duplicate_id(self):
        self.audit('<section id="intro"></section><section id="intro"></section>')
        self.assertReports("duplicate id: #intro")

    def test_distinct_ids_are_silent(self):
        self.audit('<section id="a"></section><section id="b"></section>')
        self.assertSilent()

    def test_img_without_alt(self):
        self.write("talks/2026-01-01-demo/a.png", b"x")
        self.audit('<img src="a.png">')
        self.assertReports("<img> without alt attribute")

    def test_empty_alt_is_allowed(self):
        self.write("talks/2026-01-01-demo/a.png", b"x")
        self.audit('<img src="a.png" alt="">')
        self.assertSilent()

    def test_iframe_without_title(self):
        self.audit('<iframe src="https://example.org/"></iframe>')
        self.assertReports("<iframe> without title")

    def test_iframe_with_blank_title(self):
        self.audit('<iframe src="https://example.org/" title="   "></iframe>')
        self.assertReports("<iframe> without title")

    def test_blank_target_without_noopener(self):
        self.audit('<a href="https://example.org/" target="_blank">out</a>')
        self.assertReports('target="_blank" without rel="noopener"')

    def test_blank_target_with_noopener_is_silent(self):
        self.audit('<a href="https://example.org/" target="_blank" '
                   'rel="noopener noreferrer">out</a>')
        self.assertSilent()

    def test_stale_placeholders_in_a_published_deck(self):
        self.audit("<p>TODO: rewrite</p><!-- FIXME --><p>lorem ipsum dolor</p>")
        for word in ("TODO", "FIXME", "lorem ipsum"):
            self.assertReports(f"stale placeholder {word!r}")

    def test_placeholders_allowed_outside_published_decks(self):
        self.audit("<!-- TODO: fill this in -->", published_deck=False,
                   rel="talks/_template/index.html")
        self.assertSilent()

    def test_placeholder_error_carries_a_line_number(self):
        self.audit("<p>one</p>\n<p>two</p>\n<p>TODO</p>")
        self.assertReports("(line 3)")

    def test_fit_override_requires_a_reason(self):
        self.audit('<section data-fit-allow></section>')
        self.assertReports("data-fit-allow needs a non-empty reason")

    def test_fit_override_with_reason_is_silent(self):
        self.audit('<section data-fit-allow="full-bleed map"></section>')
        self.assertSilent()


class CssChecks(AuditCase):
    def test_missing_css_url_is_an_error(self):
        path = self.write("shared/theme.css", ".x { background: url('./missing.png'); }")
        audit.audit_css(path, self.rep)
        self.assertReports("missing local CSS reference")

    def test_present_css_url_and_remote_url_are_silent(self):
        self.write("shared/image.png", b"png")
        path = self.write(
            "shared/theme.css",
            "@import 'other.css'; .a{background:url(image.png)} .b{background:url(https://example.org/x.png)}",
        )
        self.write("shared/other.css", "")
        audit.audit_css(path, self.rep)
        self.assertSilent()

    def test_css_reference_cannot_escape_repository(self):
        path = self.write("shared/theme.css", ".x{background:url('../../outside.png')}")
        audit.audit_css(path, self.rep)
        self.assertReports("escapes the repository")


class ManifestSync(AuditCase):
    """audit_manifest: talks.json ↔ talk folders ↔ the landing page."""

    def test_clean_repo_is_silent(self):
        self.make_repo()
        published = audit.audit_manifest(self.rep)
        self.assertEqual(published, [TALK["slug"]])
        self.assertSilent()

    def test_missing_manifest(self):
        self.write("index.html", "<html></html>")
        audit.audit_manifest(self.rep)
        self.assertReports("manifest missing")

    def test_missing_required_field(self):
        incomplete = {k: v for k, v in TALK.items() if k != "venue"}
        self.make_repo(talks=(incomplete,))
        audit.audit_manifest(self.rep)
        self.assertReports("missing field 'venue'")

    def test_manifest_entry_without_a_deck(self):
        self.make_repo()
        os.remove(os.path.join(self.root, "talks", TALK["slug"], "index.html"))
        audit.audit_manifest(self.rep)
        self.assertReports("manifest entry without a deck")

    def test_published_deck_absent_from_the_manifest(self):
        self.make_repo()
        self.write("talks/2026-02-02-unlisted/index.html", "<html></html>")
        audit.audit_manifest(self.rep)
        self.assertReports("published deck missing from talks/talks.json: 2026-02-02-unlisted")

    def test_underscore_folders_are_not_published_decks(self):
        self.make_repo()
        self.write("talks/_template/index.html", "<html></html>")
        published = audit.audit_manifest(self.rep)
        self.assertNotIn("_template", published)
        self.assertSilent()

    def test_duplicate_slugs(self):
        self.make_repo(talks=(TALK, dict(TALK)))
        audit.audit_manifest(self.rep)
        self.assertReports("duplicate slugs in manifest")

    def test_landing_page_missing_a_talk(self):
        self.make_repo(landing="<html><body>no links here</body></html>")
        audit.audit_manifest(self.rep)
        self.assertReports("landing page does not link talk")


class PlaceholderQr(AuditCase):
    """audit_placeholder_qr: a published deck must not ship the starter's QR."""

    def setUp(self):
        super().setUp()
        self.make_repo()
        self.write("talks/_template/assets/qr-slides.png", b"placeholder-qr-bytes")

    def test_template_qr_copied_into_a_published_deck(self):
        self.write(f"talks/{TALK['slug']}/assets/qr-slides.png", b"placeholder-qr-bytes")
        audit.audit_placeholder_qr(self.rep, [TALK["slug"]])
        self.assertReports("qr-slides.png is the template's placeholder QR")

    def test_real_qr_is_silent(self):
        self.write(f"talks/{TALK['slug']}/assets/qr-slides.png", b"a-real-qr-code")
        audit.audit_placeholder_qr(self.rep, [TALK["slug"]])
        self.assertSilent()

    def test_deck_without_a_qr_is_silent(self):
        audit.audit_placeholder_qr(self.rep, [TALK["slug"]])
        self.assertSilent()


class VendorIntegrity(AuditCase):
    """audit_vendor: vendored third-party files match the recorded digests."""

    def vendor(self, manifest, files):
        for rel, content in files.items():
            self.write(f"shared/{rel}", content)
        self.write("shared/vendor-manifest.json", json.dumps(manifest))
        audit.audit_vendor(self.rep)

    @staticmethod
    def sha256(text):
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def test_single_file_with_a_bare_digest(self):
        body = "window.hljs={};\n"
        self.vendor({"highlight.js": {"file": "highlight.min.js",
                                      "sha256": self.sha256(body)}},
                    {"highlight.min.js": body})
        self.assertSilent()
        self.assertSilent("warnings")

    def test_tampered_file_is_an_error(self):
        body = "window.hljs={};\n"
        self.vendor({"highlight.js": {"file": "highlight.min.js",
                                      "sha256": self.sha256(body)}},
                    {"highlight.min.js": body + "/* injected */\n"})
        self.assertReports("no longer matches the manifest")

    def test_error_names_both_digests(self):
        body = "window.hljs={};\n"
        tampered = body + "x"
        self.vendor({"highlight.js": {"file": "highlight.min.js",
                                      "sha256": self.sha256(body)}},
                    {"highlight.min.js": tampered})
        self.assertReports(self.sha256(tampered))
        self.assertReports(self.sha256(body))

    def test_file_list_with_a_digest_map(self):
        files = {"reveal/reveal.js": "reveal();\n", "reveal/reveal.css": ".reveal{}\n"}
        self.vendor({"reveal.js": {
            "files": list(files),
            "sha256": {rel: self.sha256(body) for rel, body in files.items()},
        }}, files)
        self.assertSilent()
        self.assertSilent("warnings")

    def test_digest_key_may_be_a_basename(self):
        files = {"reveal/reveal.js": "reveal();\n", "reveal/reveal.css": ".reveal{}\n"}
        self.vendor({"reveal.js": {
            "files": list(files),
            "sha256": {"reveal.js": self.sha256(files["reveal/reveal.js"]),
                       "reveal.css": self.sha256(files["reveal/reveal.css"])},
        }}, files)
        self.assertSilent()

    def test_unresolvable_digest_key(self):
        self.vendor({"reveal.js": {"files": ["reveal/reveal.js"],
                                   "sha256": {"nowhere.js": "0" * 64}}},
                    {"reveal/reveal.js": "reveal();\n"})
        self.assertReports("does not name one listed file")

    def test_vendored_file_missing_from_disk(self):
        self.vendor({"reveal.js": {"files": ["reveal/reveal.js", "reveal/plugin/zoom.js"],
                                   "sha256": {"reveal/reveal.js": self.sha256("reveal();\n")}}},
                    {"reveal/reveal.js": "reveal();\n"})
        self.assertReports("vendored file missing: shared/reveal/plugin/zoom.js")

    def test_listed_file_without_a_digest_warns(self):
        files = {"reveal/reveal.js": "reveal();\n", "reveal/reset.css": "*{}\n"}
        self.vendor({"reveal.js": {
            "files": list(files),
            "sha256": {"reveal/reveal.js": self.sha256(files["reveal/reveal.js"])},
        }}, files)
        self.assertSilent()
        self.assertReports("no sha256 recorded for shared/reveal/reset.css", "warnings")

    def test_missing_manifest(self):
        audit.audit_vendor(self.rep)
        self.assertReports("vendor manifest missing")

    def test_unreadable_manifest(self):
        self.write("shared/vendor-manifest.json", "{not json")
        audit.audit_vendor(self.rep)
        self.assertReports("unreadable vendor manifest")

    def test_repository_manifest_matches_its_vendored_files(self):
        """The real shared/ tree, not a fixture — the check CI actually runs."""
        audit.ROOT = self._real_root
        audit.audit_vendor(self.rep)
        self.assertSilent()
        self.assertSilent("warnings")


class PublicationBuild(AuditCase):
    """audit_site: the deployed copy carries no notes and no dev-only files."""

    def make_site(self, extra=None):
        site = os.path.join(self._tmp.name, "_site")
        self.write("index.html", "<html>landing</html>", root=site)
        self.write("shared/theme.css", "css", root=site)
        self.write(".nojekyll", "", root=site)
        for rel, content in (extra or {}).items():
            self.write(rel, content, root=site)
        return site

    def test_clean_build_is_silent(self):
        audit.audit_site(self.rep, self.make_site())
        self.assertSilent()

    def test_build_directory_absent(self):
        audit.audit_site(self.rep, os.path.join(self._tmp.name, "nowhere"))
        self.assertReports("publication build directory not found")

    def test_required_entries_missing(self):
        site = self.make_site()
        os.remove(os.path.join(site, ".nojekyll"))
        audit.audit_site(self.rep, site)
        self.assertReports("missing from publication build: .nojekyll")

    def test_development_only_files_published(self):
        for dev, content in (("README.md", "docs"), ("tools/audit.py", "tool"),
                             (".github/workflows/pages.yml", "ci"),
                             ("talks/_template/index.html", "starter")):
            with self.subTest(dev=dev):
                self.rep = audit.Report()
                audit.audit_site(self.rep, self.make_site({dev: content}))
                self.assertReports("development-only file published")

    def test_speaker_notes_left_in_the_build(self):
        for markup in ('<aside class="notes">cue</aside>',
                       "<aside class='notes'>cue</aside>",
                       '<ASIDE CLASS="NOTES">cue</ASIDE>',
                       '<aside data-x="1" class="wide notes">cue</aside>'):
            with self.subTest(markup=markup):
                self.rep = audit.Report()
                audit.audit_site(self.rep, self.make_site({"talks/d/index.html": markup}))
                self.assertReports("speaker notes remain in the publication build")

    def test_notes_lookalike_aside_is_left_alone(self):
        audit.audit_site(self.rep, self.make_site(
            {"talks/d/index.html": '<aside class="notesque">keep</aside>'}))
        self.assertSilent()

    def test_notes_plugin_still_referenced(self):
        audit.audit_site(self.rep, self.make_site(
            {"talks/d/index.html": '<script src="../../shared/reveal/plugin/notes.js"></script>'}))
        self.assertReports("reveal notes plugin still referenced")


class AssetHygiene(AuditCase):
    """audit_assets: orphans and byte-identical duplicates (warnings)."""

    def test_unreferenced_asset_warns(self):
        self.make_repo()
        self.write("shared/assets/nobody-uses-this.png", b"bytes")
        audit.audit_assets(self.rep)
        self.assertReports("asset has no path-resolved reference", "warnings")

    def test_referenced_asset_is_silent(self):
        self.make_repo()
        self.write("shared/assets/in-use.png", b"bytes")
        self.write(f"talks/{TALK['slug']}/index.html",
                   '<img src="../../shared/assets/in-use.png" alt="x">')
        audit.audit_assets(self.rep)
        self.assertSilent("warnings")

    def test_same_basename_in_another_folder_does_not_hide_an_orphan(self):
        self.make_repo()
        self.write("shared/used/logo.png", b"used")
        self.write("shared/orphan/logo.png", b"orphan")
        self.write(f"talks/{TALK['slug']}/index.html",
                   '<img src="../../shared/used/logo.png" alt="x">')
        audit.audit_assets(self.rep)
        warned_paths = [where for where, _ in self.rep.warnings]
        self.assertIn(os.path.join("shared", "orphan", "logo.png"), warned_paths)
        self.assertNotIn(os.path.join("shared", "used", "logo.png"), warned_paths)

    def test_duplicate_files_warn(self):
        self.make_repo()
        self.write(f"talks/{TALK['slug']}/index.html",
                   '<img src="assets/copy.png" alt="a">'
                   '<img src="../../shared/assets/copy.png" alt="b">')
        self.write(f"talks/{TALK['slug']}/assets/copy.png", b"identical")
        self.write("shared/assets/copy.png", b"identical")
        audit.audit_assets(self.rep)
        self.assertReports("exact duplicate files", "warnings")

    def test_starter_and_showcase_may_share_placeholders(self):
        self.make_repo()
        self.write("talks/_template/index.html",
                   '<img src="assets/shared-placeholder.png" alt="starter">')
        self.write("talks/_showcase/index.html",
                   '<img src="assets/shared-placeholder.png" alt="showcase">')
        self.write("talks/_template/assets/shared-placeholder.png", b"identical")
        self.write("talks/_showcase/assets/shared-placeholder.png", b"identical")
        audit.audit_assets(self.rep)
        self.assertSilent("warnings")


class ImageWeight(AuditCase):
    """audit_image_weight: the pixel, byte and format ceilings (warnings)."""

    def png(self, width, height, pad=0):
        """A PNG header the parser can read, padded to a chosen byte weight."""
        ihdr = (b"IHDR" + width.to_bytes(4, "big") + height.to_bytes(4, "big")
                + b"\x08\x06\x00\x00\x00")
        return (b"\x89PNG\r\n\x1a\n" + (13).to_bytes(4, "big") + ihdr
                + b"\x00\x00\x00\x00" + b"\x00" * pad)

    def test_oversized_raster_warns(self):
        self.make_repo()
        self.write(f"talks/{TALK['slug']}/index.html", '<img src="assets/huge.png" alt="x">')
        self.write(f"talks/{TALK['slug']}/assets/huge.png", self.png(4000, 2000))
        audit.audit_image_weight(self.rep)
        self.assertReports("nothing can display more than", "warnings")

    def test_raster_within_the_ceilings_is_silent(self):
        self.make_repo()
        self.write(f"talks/{TALK['slug']}/index.html", '<img src="assets/fine.png" alt="x">')
        self.write(f"talks/{TALK['slug']}/assets/fine.png", self.png(1200, 800))
        audit.audit_image_weight(self.rep)
        self.assertSilent("warnings")

    def test_heavy_raster_warns(self):
        self.make_repo()
        self.write(f"talks/{TALK['slug']}/index.html", '<img src="assets/fat.png" alt="x">')
        self.write(f"talks/{TALK['slug']}/assets/fat.png",
                   self.png(800, 600, pad=audit.BYTE_CEILING + 1))
        audit.audit_image_weight(self.rep)
        self.assertReports("people download as a PDF", "warnings")

    def test_webp_warns_whatever_its_size(self):
        self.make_repo()
        self.write(f"talks/{TALK['slug']}/index.html", '<img src="assets/small.webp" alt="x">')
        self.write(f"talks/{TALK['slug']}/assets/small.webp", b"RIFF\x00\x00\x00\x00WEBPVP8 ")
        audit.audit_image_weight(self.rep)
        self.assertReports("WebP ships to the PDF export", "warnings")

    def test_unpublished_decks_are_not_policed(self):
        self.make_repo()
        self.write("talks/_showcase/index.html", '<img src="assets/demo.png" alt="x">')
        self.write("talks/_showcase/assets/demo.png", self.png(4000, 2000))
        audit.audit_image_weight(self.rep)
        self.assertSilent("warnings")

    def test_image_size_reads_every_format_it_claims_to(self):
        cases = {
            "png": (self.png(640, 480), (640, 480)),
            "gif": (b"GIF89a" + (320).to_bytes(2, "little") + (200).to_bytes(2, "little"),
                    (320, 200)),
            "jpg": (b"\xff\xd8\xff\xc0" + (17).to_bytes(2, "big") + b"\x08"
                    + (480).to_bytes(2, "big") + (640).to_bytes(2, "big"), (640, 480)),
            "webp": (b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 10
                     + (300).to_bytes(2, "little") + (150).to_bytes(2, "little"), (300, 150)),
        }
        for ext, (blob, expected) in cases.items():
            with self.subTest(ext):
                path = self.write(f"probe.{ext}", blob)
                self.assertEqual(audit.image_size(path), expected)

    def test_image_size_returns_none_for_a_non_image(self):
        self.assertIsNone(audit.image_size(self.write("notes.txt", b"not an image at all")))


class EndToEnd(AuditCase):
    """main(): exit status, and --strict promoting warnings to failures."""

    def setUp(self):
        super().setUp()
        self.make_repo()
        body = "window.hljs={};\n"
        self.write("shared/highlight.min.js", body)
        # loaded by the landing page so the path-aware orphan check stays quiet
        self.write("index.html",
                   f'<html><a href="talks/{TALK["slug"]}/">t</a>'
                   '<script src="shared/highlight.min.js"></script></html>')
        self.write("shared/vendor-manifest.json", json.dumps(
            {"highlight.js": {"file": "highlight.min.js",
                              "sha256": VendorIntegrity.sha256(body)}}))

    @staticmethod
    def run_audit(argv):
        """audit.main prints its report; the exit status is what we assert on."""
        with contextlib.redirect_stdout(io.StringIO()):
            return audit.main(argv)

    def test_clean_repo_exits_zero(self):
        self.assertEqual(self.run_audit([]), 0)
        self.assertEqual(self.run_audit(["--strict"]), 0)

    def test_error_exits_one(self):
        self.write(f"talks/{TALK['slug']}/index.html", '<img src="gone.png" alt="x">')
        self.assertEqual(self.run_audit([]), 1)

    def test_tampered_vendor_file_fails_the_audit(self):
        self.write("shared/highlight.min.js", "window.hljs={};\n/* injected */\n")
        self.assertEqual(self.run_audit([]), 1)

    def test_warning_only_fails_under_strict(self):
        self.write("shared/assets/orphan-asset.png", b"bytes")
        self.assertEqual(self.run_audit([]), 0)
        self.assertEqual(self.run_audit(["--strict"]), 1)

    def test_site_argument_audits_the_build(self):
        site = os.path.join(self._tmp.name, "_site")
        self.write("index.html", "<html>landing</html>", root=site)
        self.write("shared/theme.css", "css", root=site)
        self.write(".nojekyll", "", root=site)
        self.assertEqual(self.run_audit(["--site", site]), 0)
        self.write("README.md", "docs", root=site)
        self.assertEqual(self.run_audit(["--site", site]), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
