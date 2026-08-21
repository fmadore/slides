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
        self.styles = []        # (css source, first line)  per-deck <style> blocks
        self.inline_styles = []  # (declarations, line)      style="…" attributes
        self._in_style = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if (a.get("style") or "").strip():
            self.inline_styles.append((a["style"], self.getpos()[0]))
        if tag == "style":
            self._in_style = True
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

    def handle_endtag(self, tag):
        if tag == "style":
            self._in_style = False

    def handle_data(self, data):
        # getpos() is the start of this data chunk, so a rule's line number
        # stays true to the file the author reads.
        if self._in_style and data.strip():
            self.styles.append((data, self.getpos()[0]))

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
        dirnames[:] = [d for d in dirnames if d not in PRUNED_DIRS]
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


# --- per-deck CSS: the theme's own rules, where the theme cannot reach -------
#
# A deck may carry its own <style> block, and per-deck CSS inherits nothing: a
# pattern the shared theme retired stays retired in the theme alone, and the
# next deck that hand-rolls a component brings it back. A hand sweep of the
# five published decks found four such defects — a `transition: all` that faded
# the focus ring up over 220ms, a card the system had retired, and two type
# sizes under the theme's own floor — none of which the theme could reach from
# where it sits. The checks below are those rules, each one a line of DESIGN.md
# applied to whatever a deck styles for itself.
#
# Every rule has a known-bad fixture in tools/test_audit.py that proves it
# still fires. That is not ceremony: the first draft of this parser never reset
# its brace depth, read one rule out of a 128-line stylesheet, and reported the
# archives clean.

CssRule = collections.namedtuple("CssRule", "selector body line")
CssDecl = collections.namedtuple("CssDecl", "prop value line")

# At-rules whose braces hold rules rather than declarations: descend into them.
AT_CONTAINER_RE = re.compile(r"^@(?:media|supports|layer|container|scope|document)\b", re.I)


def _skip_css_string(source, i):
    """Index just past the string literal that opens at source[i]."""
    quote, i = source[i], i + 1
    while i < len(source):
        if source[i] == "\\":
            i += 2
            continue
        if source[i] == quote:
            return i + 1
        i += 1
    return i


def strip_css_comments(text):
    """Drop /* … */ comments, keeping every newline so lines still count."""
    out, i, n = [], 0, len(text)
    while i < n:
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            end = n if end < 0 else end + 2
            out.append("\n" * text.count("\n", i, end))
            i = end
        elif text[i] in "\"'":
            end = _skip_css_string(text, i)
            out.append(text[i:end])
            i = end
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def _read_css_block(source, i, line):
    """Consume a declaration block; return (body, index past '}', line)."""
    start, depth, n = i, 1, len(source)
    while i < n and depth:
        if source.startswith("/*", i):
            end = source.find("*/", i + 2)
            end = n if end < 0 else end + 2
            line += source.count("\n", i, end)
            i = end
            continue
        if source[i] in "\"'":
            end = _skip_css_string(source, i)
            line += source.count("\n", i, end)
            i = end
            continue
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
        elif source[i] == "\n":
            line += 1
        i += 1
    return (source[start:i - 1] if not depth else source[start:i]), i, line


def iter_css_rules(source, first_line=1):
    """Yield CssRule for every declaration block in a stylesheet.

    @media and friends are descended into so a rule inside a query reads like a
    top-level one; comments and string literals are skipped so a brace inside
    either cannot move the depth — and the depth is *reset* at every closing
    brace, which is the bug that made the first hand-rolled sweep read one rule
    out of a whole stylesheet and call the archives clean.
    """
    prelude, prelude_line, line = [], first_line, first_line
    i, n = 0, len(source)
    while i < n:
        ch = source[i]
        if source.startswith("/*", i):
            end = source.find("*/", i + 2)
            end = n if end < 0 else end + 2
            line += source.count("\n", i, end)
            i = end
            continue
        if ch in "\"'":
            end = _skip_css_string(source, i)
            prelude.append(source[i:end])
            line += source.count("\n", i, end)
            i = end
            continue
        if ch == "{":
            selector = "".join(prelude).strip()
            prelude = []
            if AT_CONTAINER_RE.match(selector):
                i += 1                      # its children are rules of their own
                continue
            body, i, line = _read_css_block(source, i + 1, line)
            if selector:
                yield CssRule(selector, body, prelude_line)
            continue
        if ch == "}" or (ch == ";" and "".join(prelude).lstrip().startswith("@")):
            prelude = []                    # a stray close, or an @import statement
        elif prelude or not ch.isspace():
            if not prelude:
                prelude_line = line
            prelude.append(ch)
        if ch == "\n":
            line += 1
        i += 1


def iter_css_declarations(body, first_line=1):
    """Yield CssDecl for each `property: value` pair in a block body."""
    body = strip_css_comments(body)
    depth, start, i, n = 0, 0, 0, len(body)
    chunks = []
    while i < n:
        ch = body[i]
        if ch in "\"'":
            i = _skip_css_string(body, i)
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch == ";" and not depth:
            chunks.append((body[start:i], start))
            start = i + 1
        i += 1
    chunks.append((body[start:n], start))
    for text, offset in chunks:
        if ":" not in text:
            continue
        prop, value = text.split(":", 1)
        line = first_line + body.count("\n", 0, offset + len(text) - len(text.lstrip()))
        prop = prop.strip().lower()
        value = re.sub(r"!\s*important\s*$", "", value.strip(), flags=re.I).strip()
        if prop and value and not prop.startswith("--"):
            yield CssDecl(prop, value, line)


# The chrome that lives outside the scaled 1280x720 canvas — the only place a
# deck may size against the viewport (DESIGN.md, The Fixed Canvas Rule).
OUTSIDE_CANVAS = (".deck-footer", ".deck-runhead", ".deck-nav", ".deck-progress",
                  ".toc-", ".deck-lightbox", ".lightbox", ".print-imprint",
                  "reveal-print", ".backgrounds")
# Components that genuinely float above the deck, so a shadow is theirs to
# carry (DESIGN.md, The Overlay-Only Shadow Rule).
OVERLAY_SELECTORS = (".site-frame", ".chrome", ".demo-shot", ".site-qr", ".qr-pop",
                     ".toc-panel", ".toc-overlay", ".deck-lightbox", ".lightbox")
# The hero layouts the theme centres itself — and has to centre at `.present`
# specificity, because reveal hard-sets display:block on the active slide.
HERO_SUBJECT_RE = re.compile(
    r"section\.(?:cover|section|statement|closing|metric|center|balance)\b")
VIEWPORT_UNIT_RE = re.compile(
    r"(?<![\w.-])\d*\.?\d+(?:v[wh]|vmin|vmax|vi|vb|[dsl]v[wh])\b", re.I)
HEX_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b")
LENGTH_RE = re.compile(r"^(\d*\.?\d+)(rem|px|pt)$", re.I)
HAIRLINE_RE = re.compile(r"var\(\s*--hair\s*\)|1px\s+solid\s+var\(\s*--line\s*\)", re.I)
DRAW_RUN_RE = re.compile(r"var\(\s*--draw-run\b", re.I)
KEYWORDS = ("none", "initial", "inherit", "unset", "revert")
# The six binding Bayreuth corporate colours. A deck that spells one out by
# hand has left the token behind, and will not follow it when it moves.
CORPORATE_HEX = {"#009260": "--green", "#00268a": "--navy", "#cca352": "--gold",
                 "#f59c08": "--amber", "#d57912": "--brown", "#44b8f2": "--sky"}
# Two floors, because the label voice splits by reading distance. Inside the
# canvas the smallest type the theme gives anything a hall reads is
# --fs-caption (1.00rem); the one smaller size, --fs-footer (0.80rem), is
# reserved for chrome and fine print and is always spelled as the token, so a
# hand-written length under the caption size is drift either way. Outside the
# canvas --fs-footer is itself the floor — the running head sat at 0.74rem
# until a pass caught it.
CANVAS_FLOOR_REM = 1.00
CHROME_FLOOR_REM = 0.80
PX_PER_REM = 16.0


def _in_canvas(selector):
    """True unless the selector names chrome that sits outside the canvas."""
    low = selector.lower()
    return not any(hook in low for hook in OUTSIDE_CANVAS)


def _is_overlay(selector):
    low = selector.lower()
    return any(hook in low for hook in OVERLAY_SELECTORS)


def _hero_subject(selector):
    """The hero layout this rule actually styles, or None.

    Only the last compound of each comma-separated selector counts: a deck may
    freely style something *inside* a hero (`section.closing h2`); what it may
    not do is re-patch the hero box itself.
    """
    for part in selector.split(","):
        last = re.split(r"[\s>+~]+", part.strip())[-1]
        if HERO_SUBJECT_RE.search(last):
            return last
    return None


def _keyword(value):
    """The value's first token, lowercased — enough to spot `none` and friends."""
    return value.lower().split()[0] if value.split() else ""


def _rem(value):
    """A bare length in rem, or None if it is a token, a calc() or relative."""
    match = LENGTH_RE.match(value.strip())
    if not match:
        return None
    size, unit = float(match.group(1)), match.group(2).lower()
    return {"rem": size, "px": size / PX_PER_REM, "pt": size * 4 / 3 / PX_PER_REM}[unit]


def _corporate_hex(value):
    for raw in HEX_RE.findall(value):
        hexcode = raw.lower()
        if len(hexcode) == 4:                       # #abc -> #aabbcc
            hexcode = "#" + "".join(ch * 2 for ch in hexcode[1:])
        hexcode = hexcode[:7]                       # a trailing alpha pair is still the colour
        if hexcode in CORPORATE_HEX:
            return raw, CORPORATE_HEX[hexcode]
    return None, None


def check_css_declaration(decl, selector, rep, rel):
    """The rules that can be read one declaration at a time."""
    where = f"{selector} " if selector else "inline style "
    at = f"{{{decl.prop}: {decl.value}}} (line {decl.line})"
    if _in_canvas(selector) and (VIEWPORT_UNIT_RE.search(decl.value)
                                 or re.search(r"\bclamp\s*\(", decl.value, re.I)):
        rep.error(rel, f"{where}{at} — sizing against the viewport inside the scaled canvas; "
                       f"the stage is a fixed 1280x720 that reveal scales as a whole, so size "
                       f"in rem. vw/vh/clamp() belong to the unscaled chrome only")
    if decl.prop in ("transition", "transition-property") and \
            re.search(r"(?<![\w-])all(?![\w-])", decl.value, re.I):
        rep.error(rel, f"{where}{at} — `all` sweeps outline-color and outline-offset in too, so "
                       f"the focus ring fades up over the duration instead of landing with "
                       f"focus; name the properties")
    if decl.prop == "box-shadow" and not _is_overlay(selector) \
            and _keyword(decl.value) not in KEYWORDS and "inset" not in decl.value.lower():
        rep.error(rel, f"{where}{at} — a shadow on in-flow slide content; slide content is "
                       f"flat, and a shadow belongs only to something that genuinely floats "
                       f"(TOC panel, lightbox, QR pop, the browser-chrome frame)")
    if decl.prop == "font-size":
        size, canvas = _rem(decl.value), _in_canvas(selector)
        floor = CANVAS_FLOOR_REM if canvas else CHROME_FLOOR_REM
        if size is not None and size < floor - 1e-9:
            rep.error(rel, f"{where}{at} — {size * PX_PER_REM:.1f}px is under the "
                           f"{floor:.2f}rem floor for " + ("the canvas" if canvas else "chrome")
                           + "; take " + ("var(--fs-caption) or var(--fs-label), which are sized "
                                          "for the hall" if canvas else "var(--fs-footer)"))
    raw, token = _corporate_hex(decl.value)
    if raw:
        rep.error(rel, f"{where}{at} — {raw} spells a corporate colour out by hand; use "
                       f"var({token}), which follows the theme when it moves")
    if decl.prop in ("animation", "animation-duration") and \
            _keyword(decl.value) not in KEYWORDS and not DRAW_RUN_RE.search(decl.value):
        rep.error(rel, f"{where}{at} — the duration does not come from var(--draw-run); print, "
                       f"?print-pdf, prefers-reduced-motion and .no-draw all still the deck "
                       f"through that one property, and none of them can reach this mark")


def check_css_rule(rule, rep, rel):
    """The rules that need the whole declaration block to see."""
    fill = hairline = radius = None
    hero = _hero_subject(rule.selector)
    for decl in iter_css_declarations(rule.body, rule.line):
        check_css_declaration(decl, rule.selector, rep, rel)
        if decl.prop in ("background", "background-color") and \
                _keyword(decl.value) not in KEYWORDS + ("transparent",):
            fill = decl
        elif decl.prop == "border" and HAIRLINE_RE.search(decl.value):
            hairline = decl
        elif decl.prop == "border-radius" and _keyword(decl.value) not in KEYWORDS + ("0", "0px"):
            radius = decl
        elif hero and ((decl.prop == "display" and "flex" in decl.value.lower())
                       or (decl.prop == "justify-content" and "center" in decl.value.lower())):
            rep.error(rel, f"{rule.selector} {{{decl.prop}: {decl.value}}} (line {decl.line}) "
                           f"— hand-patches the centring of {hero}, which the theme owns at "
                           f"`.present` — the specificity it takes to beat reveal's "
                           f"display:block on the active slide; a second copy only drifts")
            hero = None                     # one report per rule is the finding
    if fill and hairline and radius:
        rep.error(rel, f"{rule.selector} (line {rule.line}) — a fill, a hairline border and a "
                       f"radius is the retired card; the broadsheet leans on rules, not cards, "
                       f"so let the fill alone be the surface, as .reveal pre, .scroll-panel "
                       f"and .extract each had to")


def audit_deck_css(path, rep):
    """A deck's own CSS, held to the rules the shared theme states."""
    rel = os.path.relpath(path, ROOT)
    with open(path, encoding="utf-8") as handle:
        parser = DeckParser()
        parser.feed(handle.read())
    for source, first_line in parser.styles:
        for rule in iter_css_rules(source, first_line):
            if rule.selector.startswith("@"):
                continue        # @keyframes / @font-face carry no slide styling
            check_css_rule(rule, rep, rel)
    for declarations, line in parser.inline_styles:
        # An inline style has no selector, so it is read as in-canvas content:
        # everything a deck writes one on lives inside .slides.
        for decl in iter_css_declarations(declarations, line):
            check_css_declaration(decl, "", rep, rel)


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
        dirnames[:] = [d for d in dirnames if d not in PRUNED_DIRS]
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
        if in_talks:
            audit_deck_css(path, rep)
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
