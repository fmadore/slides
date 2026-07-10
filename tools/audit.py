#!/usr/bin/env python3
"""Repository audit — one command that checks the whole site's integrity.

Static checks (no browser, stdlib only):
  • missing local images / scripts / stylesheets / iframes / embedded files
  • duplicate HTML ids
  • <img> without alt, <iframe> without title
  • target="_blank" links without rel="noopener"
  • manifest sync: talks/talks.json ↔ talks/ folders ↔ the landing page
  • stale placeholders (TODO/FIXME/lorem) and placeholder QR codes in
    published decks
  • orphaned assets and exact duplicate files (warnings)
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

# Landing-page links that are generated at build time (they exist on the live
# site, not in the repo).
GENERATED = {"slides.pdf", "offline.zip", "social-card.png"}

# Files that must never appear in a publication build (see the allowlist in
# tools/strip-notes.py).
DEV_ONLY = ["README.md", ".gitignore", ".gitattributes", ".impeccable.md",
            "serve-deck.py", "tools", ".github", "roadmap.md",
            os.path.join("talks", "_template"), os.path.join("talks", "_showcase")]

PLACEHOLDER_RE = re.compile(r"\b(TODO|FIXME|XXX|lorem ipsum)\b", re.IGNORECASE)
TEXT_EXT = {".html", ".css", ".js", ".json", ".md", ".svg", ".txt", ".py", ".yml"}


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
        self.notes = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "img":
            src = a.get("src") or a.get("data-src")
            if src:
                self.refs.append(("img", src))
            if "alt" not in a:
                self.imgs_without_alt.append(src or "<inline>")
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
        elif tag == "source" and a.get("src"):
            self.refs.append(("source", a["src"]))
        elif tag == "a" and a.get("href"):
            self.refs.append(("a", a["href"]))
            if a.get("target") == "_blank" and "noopener" not in (a.get("rel") or ""):
                self.blank_without_noopener.append(a["href"])
        elif tag == "aside" and "notes" in (a.get("class") or "").split():
            self.notes += 1
        for key in ("data-skill-src", "data-embed-src"):
            if a.get(key):
                self.refs.append(("embed", a[key]))


def is_local(url):
    p = urlparse(url)
    return not p.scheme and not url.startswith(("#", "//", "mailto:", "data:"))


def local_path(base_dir, url):
    path = unquote(urlparse(url).path)
    if not path:
        return None
    return os.path.normpath(os.path.join(base_dir, path))


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
        if kind == "a" and os.path.basename(urlparse(url).path) in GENERATED:
            continue
        if is_local(url):
            target = local_path(base, url)
            if target and not os.path.exists(target):
                rep.error(rel, f"missing local {kind}: {url}")

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


def file_md5(path):
    h = hashlib.md5()
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
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    slugs = [t["slug"] for t in manifest.get("talks", [])]
    for t in manifest.get("talks", []):
        for field in ("slug", "date", "language", "event", "venue", "title",
                      "shortTitle", "description", "presenters"):
            if not t.get(field):
                rep.error("talks/talks.json", f"{t.get('slug', '?')}: missing field {field!r}")
        deck = os.path.join(ROOT, "talks", t["slug"], "index.html")
        if not os.path.exists(deck):
            rep.error("talks/talks.json", f"manifest entry without a deck: {t['slug']}")
    published = sorted(
        d for d in os.listdir(os.path.join(ROOT, "talks"))
        if os.path.isdir(os.path.join(ROOT, "talks", d)) and not d.startswith("_")
    )
    for d in published:
        if d not in slugs:
            rep.error("talks/", f"published deck missing from talks/talks.json: {d}")
    if sorted(slugs) != sorted(set(slugs)):
        rep.error("talks/talks.json", "duplicate slugs in manifest")

    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as fh:
        landing = fh.read()
    for slug in slugs:
        if f"talks/{slug}/" not in landing:
            rep.error("index.html", f"landing page does not link talk: {slug}")
    return published


def audit_placeholder_qr(rep, published):
    tpl = os.path.join(ROOT, "talks", "_template", "assets", "qr-slides.png")
    if not os.path.exists(tpl):
        return
    tpl_md5 = file_md5(tpl)
    for slug in published:
        qr = os.path.join(ROOT, "talks", slug, "assets", "qr-slides.png")
        if os.path.exists(qr) and file_md5(qr) == tpl_md5:
            rep.error(f"talks/{slug}", "qr-slides.png is the template's placeholder QR")


def audit_assets(rep):
    """Orphaned assets and exact duplicate files (warnings)."""
    corpus = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "_site"}]
        for n in filenames:
            if os.path.splitext(n)[1] in TEXT_EXT:
                try:
                    with open(os.path.join(dirpath, n), encoding="utf-8") as fh:
                        corpus.append(fh.read())
                except UnicodeDecodeError:
                    pass
    corpus = "\n".join(corpus)

    hashes = {}
    for sub in ("talks", "shared"):
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, sub)):
            for n in filenames:
                path = os.path.join(dirpath, n)
                rel = os.path.relpath(path, ROOT)
                ext = os.path.splitext(n)[1]
                if n in {".gitkeep", "talks.json"} or ext in {".html", ".py"}:
                    continue
                if n not in corpus:
                    rep.warn(rel, "asset is not referenced anywhere (orphan?)")
                if ext in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".md", ".pdf"}:
                    hashes.setdefault(file_md5(path), []).append(rel)
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
    audit_placeholder_qr(rep, published)
    audit_assets(rep)
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
