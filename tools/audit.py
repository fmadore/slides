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
  • per-deck CSS against the rules the shared theme states in DESIGN.md:
    viewport units inside the scaled canvas, `transition: all`, shadows on
    in-flow content, the retired card shape, type under the chrome floor,
    corporate hex where a token exists, hand-patched hero centring, and
    animations no stiller can reach
  • the site pages outside talks/ (landing, 404) against the two of those
    rules that hold on any page: `transition: all` and hand-spelled hex
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
import collections
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
from slideslib.publication import reference_errors
from slideslib.notes import remaining_notes
from slideslib import asset_audit, css_audit, vendor_audit
from slideslib.html_refs import (DeckParser, css_references, is_local, is_within, iter_html, local_path)
from slideslib.css_audit import iter_css_rules, iter_css_declarations
from slideslib.asset_audit import BYTE_CEILING, PIXEL_CEILING, image_size, file_digest

# Landing-page links that are generated at build time (they exist on the live
# site, not in the repo).
GENERATED = {"slides.pdf", "social-card.png"}

# Directories the walks never descend into. `.claude` holds git worktrees, and a
# worktree is a second copy of this repository: walked, its `shared/src`
# partials fail the exclusion below (which tests a path relative to ROOT) and
# get audited as standalone stylesheets, so the bundle-relative `fonts/fonts.css`
# reads as a missing reference. One tree is audited at a time — its own.
PRUNED_DIRS = {".git", ".claude", "node_modules", "_site"}

# Files that must never appear in a publication build (see the allowlist in
# tools/strip-notes.py).
DEV_ONLY = ["README.md", ".gitignore", ".gitattributes", "PRODUCT.md",
            "DESIGN.md", ".impeccable",
            "serve-deck.py", "tools", ".github", "roadmap.md", "docs", "scratchpad",
            os.path.join("talks", "_template"), os.path.join("talks", "_showcase"),
            os.path.join("shared", "src"),
            os.path.join("shared", "vendor-manifest.json"),
            os.path.join("shared", "reveal", "plugin", "notes.js")]

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


def audit_deck_css(path, rep):
    return css_audit.audit_deck_css(path, rep, ROOT)


def audit_page_css(path, rep):
    return css_audit.audit_page_css(path, rep, ROOT)




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
    return vendor_audit.audit_vendor(rep, ROOT)



def reference_targets():
    return asset_audit.reference_targets(ROOT)


def audit_image_weight(rep):
    return asset_audit.audit_image_weight(rep, ROOT)


def audit_assets(rep):
    return asset_audit.audit_assets(rep, ROOT)



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
    for where, message in reference_errors(site):
        rep.error(os.path.join("_site", where), message)
    for path in iter_html(site):
        rel = os.path.join("_site", os.path.relpath(path, site))
        with open(path, encoding="utf-8") as fh:
            html = fh.read()
        if remaining_notes(html):
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
        if in_talks and os.path.basename(path) != "read.html":
            audit_deck_css(path, rep)
        else:
            audit_page_css(path, rep)
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in PRUNED_DIRS]
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
