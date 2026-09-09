import io, sys

path = 'IMPECCABLE-ROADMAP.md'
s = io.open(path, encoding='utf-8', newline='').read()

OLD = """## Phase 3 — Per-deck work

- **Published talks are archives.** They inherit system improvements through
  the shared theme, but get no individual redesign — QA sweep only."""

NEW = """## Phase 3 — Per-deck work

*Status: ✅ COMPLETE 2026-08-20.*

The sweep was mechanical first: a linter over every deck's `<style>` block and
inline styles, checking the five archives against the rules the six Phase 2
passes established. Its first run reported zero findings, which was wrong — the
rule parser never reset its brace depth, so it read one rule out of a 128-line
stylesheet and stopped. Fixed, it read 42 and fired on all eight checks against
a known-bad fixture. **A clean report from an unproven check is not evidence**;
that is the transferable lesson of this phase.

Corrected, it found eight candidates in three decks, and measuring cut them to
four. Two flagged raw `--green` were false alarms: both sit at 24px/700, which
is WCAG large text, and measure 3.87:1 against Paper where 3:1 is the bar. (The
first contrast probe reported 2.22:1 and 1.03:1 — it round-tripped colours
through a canvas `fillStyle`, which does not resolve `oklch()`, so it was
reading the OKLCH components as if they were RGB. Painting the colour and
reading the pixel back gave the real numbers.) Rhodes' `.site-frame` shadow was
the theme's own value re-declared, not a deviation.

What was real: luxembourg's `.kvm-btn` demo buttons still carried
`transition: all`, so their focus ring faded up over 220ms — the exact defect
Pass 5 removed from the theme, still live in a deck because per-deck CSS
inherits nothing. dga's `.extract` was a Sunken fill with a hairline border and
a radius, the card pattern Pass 5 retired on `.reveal pre`. And two type sizes
sat below the theme's own chrome floor inside the scaled canvas — dga's
book-cover captions at 11.8px and luxembourg's demo tags at 9.9px — which is
Pass 1's finding surviving in per-deck CSS. All four fixed; both decks hold
their previous auto-fit scales exactly, and the demo table absorbed a 62%
larger tag without a row overflowing. dga's `--shadow-1` on in-flow book covers
was left as delivered, by the author's call.

**The Pass 3 open item is closed.** `.scroll-panel` had no print handling at
all: the PDF hard-cut mid-sentence with no mark, under authored copy still
telling the reader to scroll. A 190-line file cannot fit a 1280×720 page under
the one-page-per-slide contract, so the excerpt was never avoidable — only the
silence was. Print now draws the cut in the system's vocabulary: the text fades
into the Sunken fill, the heavy near-black rule that opens a block closes this
one, and a gothic `Excerpt` band names it (`Extrait` in French decks). The
scroll instruction is suppressed on paper, and the band appends
`data-source-url` where the panel declares one — an attribute that already
existed as deck.js's load-failure fallback, so the author's own answer is
reused and luxembourg's repo URL survives into the PDF rather than being
suppressed with the hint. Both marks and the hint hang off one pair of
properties, declared once for `@media print` and once for the `?print-pdf`
preview, in the idiom Pass 6 established.

One system finding came out of the same slide: `.scroll-panel` was itself a
Sunken fill with a hairline border — the construction Pass 5 removed from
`.reveal pre` and missed on its scrollable sibling. Now borderless, and
DESIGN.md's Don't names the scroll panel alongside code blocks.

`talks/_template/` reviewed against all six passes and needs nothing: no
hand-patched centring, no per-deck CSS at all, the single-author `.byline`
rather than the `.authors` row, and Pass 6's stepped list. The `/slides` skill
was updated in the same session — it still called the theme "editorial", the
retired direction name, and it now carries the fragment default, the `.no-draw`
opt-out with `var(--draw-run)`, and the `data-source-url` rule for PDFs.

**Every phase of this roadmap is now complete.** What remains is Phase 4, which
is standing cadence rather than work, and it lives in the `/slides` skill's hard
rules and in DESIGN.md — not here.

- **Published talks are archives.** They inherit system improvements through
  the shared theme, but get no individual redesign — QA sweep only."""

if s.count(OLD) != 1:
    sys.exit('anchor not found once')
io.open(path, 'w', encoding='utf-8', newline='').write(s.replace(OLD, NEW, 1))
print('patched', path)
