"""Per-deck theme policy checks; independent of the audit CLI."""
import collections
import os
import re
from .html_refs import DeckParser

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


def check_css_declaration(decl, selector, rep, rel, page=False):
    """The rules that can be read one declaration at a time.

    page=True is a site page outside talks/ (the landing page, the 404): it
    has no scaled canvas, no hall to read it and no motion switch, so only the
    rules that hold on any page apply there — `transition: all` and a
    corporate colour spelled out by hand.
    """
    where = f"{selector} " if selector else "inline style "
    at = f"{{{decl.prop}: {decl.value}}} (line {decl.line})"
    if decl.prop in ("transition", "transition-property") and \
            re.search(r"(?<![\w-])all(?![\w-])", decl.value, re.I):
        rep.error(rel, f"{where}{at} — `all` sweeps outline-color and outline-offset in too, so "
                       f"the focus ring fades up over the duration instead of landing with "
                       f"focus; name the properties")
    raw, token = _corporate_hex(decl.value)
    if raw:
        rep.error(rel, f"{where}{at} — {raw} spells a corporate colour out by hand; use "
                       f"var({token}), which follows the theme when it moves")
    if page:
        return
    if _in_canvas(selector) and (VIEWPORT_UNIT_RE.search(decl.value)
                                 or re.search(r"\bclamp\s*\(", decl.value, re.I)):
        rep.error(rel, f"{where}{at} — sizing against the viewport inside the scaled canvas; "
                       f"the stage is a fixed 1280x720 that reveal scales as a whole, so size "
                       f"in rem. vw/vh/clamp() belong to the unscaled chrome only")
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


def audit_deck_css(path, rep, root):
    """A deck's own CSS, held to the rules the shared theme states."""
    rel = os.path.relpath(path, root)
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


def audit_page_css(path, rep, root):
    """A site page's own CSS (landing, 404), held to the page-wide rules.

    The landing page is where a reader arrives, and it hand-rolls its styles
    like a deck does — which is how a `transition: all` survived on its Open
    cue after every deck had been swept clean of it.
    """
    rel = os.path.relpath(path, root)
    with open(path, encoding="utf-8") as handle:
        parser = DeckParser()
        parser.feed(handle.read())
    blocks = [(rule.selector, iter_css_declarations(rule.body, rule.line))
              for source, first_line in parser.styles
              for rule in iter_css_rules(source, first_line)
              if not rule.selector.startswith("@")]
    blocks += [("", iter_css_declarations(declarations, line))
               for declarations, line in parser.inline_styles]
    for selector, declarations in blocks:
        for decl in declarations:
            check_css_declaration(decl, selector, rep, rel, page=True)

