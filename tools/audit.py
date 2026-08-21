#!/usr/bin/env python3
"""Repository audit — one command that checks the whole site's integrity.

Static checks (no browser, stdlib only):
  • missing local images / scripts / stylesheets / iframes / embedded files
  • duplicate HTML ids
  • <img> without alt, <iframe> without title
  • target="_blank" links without rel="noopener"
  • vendored third-party files still match shared/vendor-manifest.json
  • manifest sync: talks/talks.json ↔ talks/ folders ↔ the landing page
  • stale placeholders (TODO/FIXME/lorem) and placeholder QR codes in
    published decks
  • orphaned assets and exact duplicate files (warnings)
  • image weight: no WebP, nothing over 1800px or 600 KB (warnings)
  • with --site DIR: the publication build carries no speaker notes, no
    notes plugin, and none of the excluded development files

Browser checks (console errors, slide fitting/overflow at the three standard
viewport sizes) live in tools/browser-check.mjs; pass --browser to run them
from here (requires node + playwright).

Exit status: 1 if any error was found (or any warning with --strict), else 0.

Usage:
  python3 tools/audit.py                 # static checks on the repo
  python3 tools/audit.py --site _site    # also check a publication build
  python3 tools/audit.py --browser       # also run the browser checks
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.dirname(os.path.abspath(__file__))
if TOOLS not in sys.path:
    sys.path.insert(0, TOOLS)

from slideslib.deck_metadata import CONFIG_START, HEAD_START, sync_deck_html
from slideslib.manifest import ManifestValidationError, load_manifest

# Landing-page links that are generated at build time (they exist on the live
# site, not in the repo).
GENERATED = {"slides.pdf", "social-card.png"}

# Files that must never appear in a publication build (see the allowlist in
# tools/strip-notes.py).
DEV_ONLY = ["README.md", ".gitignore", ".gitattributes", "PRODUCT.md",
            "DESIGN.md", ".impeccable",
            "serve-deck.py", "tools", ".github", "roadmap.md",
            os.path.join("talks", "_template"), os.path.join("talks", "_showcase"),
            os.path.join("shared", "src"),
            os.path.join("shared", "vendor-manifest.json")]

PLACEHOLDER_RE = re.compile(r"\b(TODO|FIXME|XXX|lorem ipsum)\b", re.IGNORECASE)
TEXT_EXT = {".html", ".css", ".js", ".json", ".md", ".svg", ".txt", ".py", ".yml"}
MARKDOWN_REF_RE = re.compile(r"!?\[[^\]]*\]\(\s*(?P<url>[^\s)]+)")
QUOTED_ASSET_RE = re.compile(
    r"(?P<q>['\"])(?P<url>[^'\"\n]+\.(?:png|jpe?g|webp|svg|woff2?|md|pdf|css|m?js))(?P=q)",
    re.IGNORECASE,
)


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def error(self, where, msg):
        self.errors.append((where, msg))

    def warn(self, where, msg):
        self.warnings.append((where, msg))


class DeckParser(HTMLParser):
    """Collect the references and structures the audit cares about."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []          # (kind, value)  local-or-remote references
        self.ids = []
        self.imgs_without_alt = []
        self.iframes_without_title = []
        self.blank_without_noopener = []
        self.fit_allow_without_reason = []
        self.notes = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "section" and "data-fit-allow" in a and not (a.get("data-fit-allow") or "").strip():
            self.fit_allow_without_reason.append(a.get("id") or a.get("data-toc") or "<section>")
        if tag == "img":
            src = a.get("src") or a.get("data-src")
            if src:
                self.refs.append(("img", src))
            if "alt" not in a:
                self.imgs_without_alt.append(src or "<inline>")
            self._add_srcset("img", a.get("srcset") or a.get("data-srcset"))
        elif tag == "script" and a.get("src"):
            self.refs.append(("script", a["src"]))
        elif tag == "link" and a.get("href"):
            self.refs.append(("link", a["href"]))
        elif tag == "iframe":
            src = a.get("src") or a.get("data-src")
            if src:
                self.refs.append(("iframe", src))
            if not (a.get("title") or "").strip():
                self.iframes_without_title.append(src or "<inline>")
        elif tag == "source":
            if a.get("src"):
                self.refs.append(("source", a["src"]))
            self._add_srcset("source", a.get("srcset"))
        elif tag in {"audio", "video"}:
            if a.get("src"):
                self.refs.append((tag, a["src"]))
            if tag == "video" and a.get("poster"):
                self.refs.append(("poster", a["poster"]))
        elif tag == "object" and a.get("data"):
            self.refs.append(("object", a["data"]))
        elif tag == "a" and a.get("href"):
            self.refs.append(("a", a["href"]))
            if a.get("target") == "_blank" and "noopener" not in (a.get("rel") or ""):
                self.blank_without_noopener.append(a["href"])
        elif tag == "aside" and "notes" in (a.get("class") or "").split():
            self.notes += 1
        for key in ("data-skill-src", "data-embed-src"):
            if a.get(key):
                self.refs.append(("embed", a[key]))

    def _add_srcset(self, kind, value):
        if not value:
            return
        for candidate in value.split(","):
            url = candidate.strip().split(maxsplit=1)[0]
            if url:
                self.refs.append((kind, url))


def is_local(url):
    try:
        p = urlparse(url)
    except ValueError:      # malformed (e.g. an unclosed IPv6 literal)
        return False        # not ours to resolve; check-links.py reports it
    return not p.scheme and not url.startswith(("#", "//", "mailto:", "data:"))


def local_path(base_dir, url, root=None):
    path = unquote(urlparse(url).path)
    if not path:
        return None
    if path.startswith("/"):   # root-absolute (e.g. the 404 page, served at any depth)
        return os.path.normpath(os.path.join(root or ROOT, path.lstrip("/")))
    return os.path.normpath(os.path.join(base_dir, path))


def is_within(path, root):
    try:
        return os.path.commonpath((os.path.abspath(path), os.path.abspath(root))) == os.path.abspath(root)
    except ValueError:  # different drives on Windows
        return False


def iter_html(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "_site"}]
        for n in filenames:
            if n.endswith(".html"):
                yield os.path.join(dirpath, n)


def audit_html(path, rep, published_deck):
    rel = os.path.relpath(path, ROOT)
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    p = DeckParser()
    p.feed(html)

    base = os.path.dirname(path)
    for kind, url in p.refs:
        if not is_local(url):
            continue
        if kind == "a" and os.path.basename(urlparse(url).path) in GENERATED:
            continue
        target = local_path(base, url, root=ROOT)
        if target and not is_within(target, ROOT):
            rep.error(rel, f"local {kind} escapes the repository: {url}")
        elif target and not os.path.exists(target):
            rep.error(rel, f"missing local {kind}: {url}")
    for url in css_references(html):
        if not is_local(url):
            continue
        target = local_path(base, url, root=ROOT)
        if target and not is_within(target, ROOT):
            rep.error(rel, f"inline CSS reference escapes the repository: {url}")
        elif target and not os.path.exists(target):
            rep.error(rel, f"missing local inline CSS reference: {url}")

    seen, dups = set(), set()
    for i in p.ids:
        (dups if i in seen else seen).add(i)
    for d in sorted(dups):
        rep.error(rel, f"duplicate id: #{d}")

    for src in p.imgs_without_alt:
        rep.error(rel, f"<img> without alt attribute: {src}")
    for src in p.iframes_without_title:
        rep.error(rel, f"<iframe> without title: {src}")
    for href in p.blank_without_noopener:
        rep.error(rel, f'target="_blank" without rel="noopener": {href}')

    if published_deck:
        # Comments may legitimately say TODO in the template; a published talk
        # should carry no unresolved placeholders anywhere in its markup.
        for m in PLACEHOLDER_RE.finditer(html):
            line = html.count("\n", 0, m.start()) + 1
            rep.error(rel, f"stale placeholder {m.group(0)!r} (line {line})")
        for section in p.fit_allow_without_reason:
            rep.error(rel, f"data-fit-allow needs a non-empty reason: {section}")


CSS_REF_RE = re.compile(
    r"url\(\s*(?P<uq>[^)'\"\s][^)]*?)\s*\)"
    r"|url\(\s*(?P<q>['\"])(?P<quoted>.*?)(?P=q)\s*\)"
    r"|@import\s+(?P<iq>['\"])(?P<imported>.*?)(?P=iq)",
    re.IGNORECASE,
)


def css_references(source):
    for match in CSS_REF_RE.finditer(source):
        yield match.group("uq") or match.group("quoted") or match.group("imported")


def audit_css(path, rep):
    rel = os.path.relpath(path, ROOT)
    with open(path, encoding="utf-8") as handle:
        source = handle.read()
    for url in css_references(source):
        if not is_local(url):
            continue
        target = local_path(os.path.dirname(path), url, root=ROOT)
        if target and not is_within(target, ROOT):
            rep.error(rel, f"local CSS reference escapes the repository: {url}")
        elif target and not os.path.exists(target):
            rep.error(rel, f"missing local CSS reference: {url}")


def file_digest(path, algorithm="md5"):
    h = hashlib.new(algorithm)
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def audit_manifest(rep):
    """talks.json ↔ talk folders ↔ landing page, all in sync."""
    manifest_path = os.path.join(ROOT, "talks", "talks.json")
    if not os.path.exists(manifest_path):
        rep.error("talks/talks.json", "manifest missing")
        return []
    try:
        manifest = load_manifest(manifest_path)
    except ManifestValidationError as exc:
        for message in exc.errors:
            rep.error("talks/talks.json", message)
        return []
    slugs = [talk.slug for talk in manifest.talks]
    for talk in manifest.talks:
        deck = os.path.join(ROOT, "talks", talk.slug, "index.html")
        if not os.path.exists(deck):
            rep.error("talks/talks.json", f"manifest entry without a deck: {talk.slug}")
            continue
        with open(deck, encoding="utf-8") as handle:
            source = handle.read()
        if HEAD_START in source or CONFIG_START in source:
            try:
                expected = sync_deck_html(source, talk, manifest.site)
            except ValueError as exc:
                rep.error(os.path.relpath(deck, ROOT), f"generated metadata markers are incomplete: {exc}")
            else:
                if expected != source:
                    rep.error(os.path.relpath(deck, ROOT),
                              "generated metadata differs from talks/talks.json; run tools/build-index.py")
    published = sorted(
        d for d in os.listdir(os.path.join(ROOT, "talks"))
        if os.path.isdir(os.path.join(ROOT, "talks", d)) and not d.startswith("_")
    )
    for d in published:
        if d not in slugs:
            rep.error("talks/", f"published deck missing from talks/talks.json: {d}")
    landing_path = os.path.join(ROOT, "index.html")
    if not os.path.exists(landing_path):
        rep.error("index.html", "landing page missing")
        return published
    with open(landing_path, encoding="utf-8") as fh:
        landing = fh.read()
    for slug in slugs:
        if f"talks/{slug}/" not in landing:
            rep.error("index.html", f"landing page does not link talk: {slug}")
    return published


def audit_placeholder_qr(rep, published):
    tpl = os.path.join(ROOT, "talks", "_template", "assets", "qr-slides.png")
    if not os.path.exists(tpl):
        return
    tpl_md5 = file_digest(tpl)
    for slug in published:
        qr = os.path.join(ROOT, "talks", slug, "assets", "qr-slides.png")
        if os.path.exists(qr) and file_digest(qr) == tpl_md5:
            rep.error(f"talks/{slug}", "qr-slides.png is the template's placeholder QR")


def audit_vendor(rep):
    """Vendored third-party files must still match the digests we recorded.

    Two manifest shapes are in use: a single `file` with a bare `sha256`
    string (what tools/fetch-highlight.py writes), or a list of `files` with
    a `sha256` map. Map keys may be the path under shared/ or just a
    basename, as long as it resolves to exactly one listed file.
    """
    rel_manifest = os.path.join("shared", "vendor-manifest.json")
    path = os.path.join(ROOT, rel_manifest)
    if not os.path.exists(path):
        rep.error(rel_manifest, "vendor manifest missing")
        return
    try:
        with open(path, encoding="utf-8") as fh:
            manifest = json.load(fh)
    except json.JSONDecodeError as e:
        rep.error(rel_manifest, f"unreadable vendor manifest: {e}")
        return

    for package, entry in sorted(manifest.items()):
        listed = list(entry.get("files") or ([entry["file"]] if entry.get("file") else []))
        if not listed:
            rep.warn(rel_manifest, f"{package}: no vendored file recorded")
            continue

        recorded = entry.get("sha256")
        if isinstance(recorded, str):
            recorded = {listed[0]: recorded}
        elif not isinstance(recorded, dict):
            recorded = {}

        wanted = {}
        for key, digest in recorded.items():
            matches = [key] if key in listed else [f for f in listed if os.path.basename(f) == key]
            if len(matches) != 1:
                rep.error(rel_manifest,
                          f"{package}: sha256 key {key!r} does not name one listed file")
                continue
            wanted[matches[0]] = digest

        for rel in listed:
            target = os.path.join(ROOT, "shared", rel)
            if not os.path.exists(target):
                rep.error(rel_manifest, f"{package}: vendored file missing: shared/{rel}")
                continue
            if rel not in wanted:
                rep.warn(rel_manifest, f"{package}: no sha256 recorded for shared/{rel}")
                continue
            got = file_digest(target, "sha256")
            if got != wanted[rel]:
                rep.error(os.path.join("shared", rel),
                          f"{package}: vendored file no longer matches the manifest — "
                          f"sha256 is {got}, manifest says {wanted[rel]} (restore the "
                          f"vendored build, or record the new digest deliberately)")


def reference_targets():
    """Resolve local references to exact files, avoiding basename collisions."""
    targets = set()
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "_site"}]
        for name in filenames:
            path = os.path.join(dirpath, name)
            ext = os.path.splitext(name)[1].lower()
            if ext not in TEXT_EXT:
                continue
            try:
                with open(path, encoding="utf-8") as handle:
                    source = handle.read()
            except UnicodeDecodeError:
                continue
            urls = []
            if ext == ".html":
                parser = DeckParser()
                parser.feed(source)
                urls.extend(url for _, url in parser.refs)
                urls.extend(css_references(source))  # inline style blocks/attributes
            elif ext == ".css" and not os.path.relpath(path, ROOT).startswith(
                    os.path.join("shared", "src") + os.sep):
                urls.extend(css_references(source))
            elif ext == ".md":
                urls.extend(match.group("url") for match in MARKDOWN_REF_RE.finditer(source))
            elif ext in {".js", ".mjs", ".json"}:
                urls.extend(match.group("url") for match in QUOTED_ASSET_RE.finditer(source))
            for url in urls:
                if not is_local(url):
                    continue
                target = local_path(dirpath, url, root=ROOT)
                if target and is_within(target, ROOT):
                    targets.add(os.path.normcase(os.path.abspath(target)))
    return targets


# --- image weight -----------------------------------------------------------
# Both ceilings come from measuring what the decks actually display (issue #7).
#
# A raster wider than PIXEL_CEILING cannot be shown at full resolution: the
# slide area is 1280 CSS px and the lightbox tops out at 92vw, so 1800px covers
# a zoomed screenshot on a 1920-wide screen with nothing to spare.
#
# WebP is rejected outright, and not for browser support. Chrome's print-to-PDF
# passes a JPEG through byte-for-byte but has no WebP filter to pass through
# to, so it decodes every WebP and re-emits it as zlib'd RGB. Measured on the
# Erlangen deck: 1.2 MB of WebP sources became 10.1 MB of PDF images. The same
# pictures as JPEG cost 1.7 MB.
PIXEL_CEILING = 1800
BYTE_CEILING = 600 * 1024
RASTER_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def image_size(path):
    """(width, height) of a PNG/JPEG/GIF/WebP, or None. Header parsing only."""
    with open(path, "rb") as fh:
        head = fh.read(32)
        if head[:8] == b"\x89PNG\r\n\x1a\n" and head[12:16] == b"IHDR":
            return int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")
        if head[:6] in (b"GIF87a", b"GIF89a"):
            return int.from_bytes(head[6:8], "little"), int.from_bytes(head[8:10], "little")
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            chunk = head[12:16]
            if chunk == b"VP8X":
                return (int.from_bytes(head[24:27], "little") + 1,
                        int.from_bytes(head[27:30], "little") + 1)
            if chunk == b"VP8 ":
                return (int.from_bytes(head[26:28], "little") & 0x3FFF,
                        int.from_bytes(head[28:30], "little") & 0x3FFF)
            if chunk == b"VP8L":
                bits = int.from_bytes(head[21:25], "little")
                return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            return None
        if head[:2] != b"\xff\xd8":
            return None
        fh.seek(2)
        while True:
            marker = fh.read(2)
            if len(marker) < 2 or marker[0] != 0xFF:
                return None
            length = int.from_bytes(fh.read(2), "big")
            # SOF0-SOF15, minus the four markers in that range that are not
            # frame headers (DHT, JPG, DAC, and the standalone SOI).
            if 0xC0 <= marker[1] <= 0xCF and marker[1] not in (0xC4, 0xC8, 0xCC, 0xD8):
                fh.read(1)                                  # sample precision
                height = int.from_bytes(fh.read(2), "big")
                width = int.from_bytes(fh.read(2), "big")
                return width, height
            fh.seek(length - 2, os.SEEK_CUR)


def audit_image_weight(rep):
    """Shipped rasters stay inside the size and format budget (warnings)."""
    roots = [os.path.join(ROOT, "shared")]
    roots += [os.path.join(ROOT, "talks", slug) for slug in sorted(os.listdir(os.path.join(ROOT, "talks")))
              if os.path.isdir(os.path.join(ROOT, "talks", slug)) and not slug.startswith("_")]
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            for name in sorted(filenames):
                ext = os.path.splitext(name)[1].lower()
                if ext not in RASTER_EXT:
                    continue
                path = os.path.join(dirpath, name)
                rel = os.path.relpath(path, ROOT)
                if ext == ".webp":
                    rep.warn(rel, "WebP ships to the PDF export as zlib'd RGB, roughly "
                                  "10x its own weight — use JPEG for photographs, PNG for flat art")
                    continue
                size = image_size(path)
                if size and max(size) > PIXEL_CEILING:
                    rep.warn(rel, f"{size[0]}x{size[1]}: nothing can display more than "
                                  f"{PIXEL_CEILING}px (slide area is 1280px, lightbox 92vw)")
                weight = os.path.getsize(path)
                if weight > BYTE_CEILING:
                    rep.warn(rel, f"{weight / 1024:.0f} KB in a deck people download as a PDF "
                                  f"(ceiling {BYTE_CEILING // 1024} KB)")


def audit_assets(rep):
    """Path-aware orphan detection and exact duplicate files (warnings)."""
    referenced = reference_targets()

    hashes = {}
    for sub in ("talks", "shared"):
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, sub)):
            for n in filenames:
                path = os.path.join(dirpath, n)
                rel = os.path.relpath(path, ROOT)
                ext = os.path.splitext(n)[1]
                if n in {".gitkeep", "talks.json", "vendor-manifest.json"} or ext in {".html", ".py"}:
                    continue
                if rel.startswith(os.path.join("shared", "src") + os.sep):
                    continue  # build-shared.mjs accounts for every source partial
                if os.path.normcase(os.path.abspath(path)) not in referenced:
                    rep.warn(rel, "asset has no path-resolved reference (orphan?)")
                if ext in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".md", ".pdf"}:
                    hashes.setdefault(file_digest(path), []).append(rel)
    for digest, paths in sorted(hashes.items()):
        if len(paths) > 1:
            # the starter and the showcase legitimately share placeholder assets
            if all(p.split(os.sep)[1].startswith("_") for p in paths
                   if p.startswith("talks" + os.sep)) and \
               all(p.startswith("talks" + os.sep) for p in paths):
                continue
            rep.warn(paths[0], "exact duplicate files: " + " = ".join(paths)
                     + " (move one copy to shared/assets/)")


ASIDE_NOTES_RE = re.compile(
    r"<aside\b[^>]*\bclass\s*=\s*(?P<q>['\"])(?:[^'\"]*\s)?notes(?:\s[^'\"]*)?(?P=q)",
    re.IGNORECASE)


def audit_site(rep, site):
    """A publication build must be notes-free and contain no dev-only files."""
    site = os.path.abspath(site)
    if not os.path.isdir(site):
        rep.error(site, "publication build directory not found")
        return
    for required in ("index.html", "shared", ".nojekyll"):
        if not os.path.exists(os.path.join(site, required)):
            rep.error("_site", f"missing from publication build: {required}")
    for dev in DEV_ONLY:
        if os.path.exists(os.path.join(site, dev)):
            rep.error("_site", f"development-only file published: {dev}")
    for path in iter_html(site):
        rel = os.path.join("_site", os.path.relpath(path, site))
        with open(path, encoding="utf-8") as fh:
            html = fh.read()
        if ASIDE_NOTES_RE.search(html):
            rep.error(rel, "speaker notes remain in the publication build")
        if "plugin/notes.js" in html:
            rep.error(rel, "reveal notes plugin still referenced in the publication build")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--site", metavar="DIR", help="also audit a publication build directory")
    ap.add_argument("--browser", action="store_true",
                    help="also run the browser checks (node tools/browser-check.mjs)")
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    args = ap.parse_args(argv)

    rep = Report()
    published = audit_manifest(rep)
    for path in iter_html(ROOT):
        rel = os.path.relpath(path, ROOT)
        in_talks = rel.startswith("talks" + os.sep)
        underscore = in_talks and rel.split(os.sep)[1].startswith("_")
        audit_html(path, rep, published_deck=in_talks and not underscore)
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "_site"}]
        for name in filenames:
            if name.endswith(".css"):
                path = os.path.join(dirpath, name)
                if not os.path.relpath(path, ROOT).startswith(os.path.join("shared", "src") + os.sep):
                    audit_css(path, rep)
    audit_placeholder_qr(rep, published)
    audit_vendor(rep)
    audit_assets(rep)
    audit_image_weight(rep)
    if args.site:
        audit_site(rep, args.site)

    browser_ok = True
    if args.browser:
        print("running browser checks (tools/browser-check.mjs)…")
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "browser-check.mjs")])
        browser_ok = r.returncode == 0

    for where, msg in rep.errors:
        print(f"ERROR  {where}: {msg}")
    for where, msg in rep.warnings:
        print(f"warn   {where}: {msg}")
    print(f"\naudit: {len(rep.errors)} error(s), {len(rep.warnings)} warning(s) "
          f"across {len(published)} published talk(s)"
          + ("" if browser_ok else " — browser checks FAILED"))

    failed = rep.errors or (args.strict and rep.warnings) or not browser_ok
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
