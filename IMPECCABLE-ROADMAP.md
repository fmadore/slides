# Impeccable roadmap

Working plan for applying the Impeccable design skill (v4.1.1) to this repo:
first migrate the legacy design context to the current artifact set, then run a
sequence of bounded design passes over the shared Broadsheet theme and the
decks. One phase (usually one command) per session; each pass ends verified.

*Written 2026-08-17. Delete this file when the roadmap is done.*

---

## 1. Where things stand

**The legacy artifact.** `.impeccable.md` (written 2026-06-16 by an earlier
skill version) is invisible to the installed skill. Impeccable 4.1.1 reads
`PRODUCT.md`, `DESIGN.md` plus a `.impeccable/design.json` sidecar,
`.impeccable/config.json`, and per-surface briefs — none of which exist here.
Its `context.mjs` boot reports `NO_PRODUCT_MD` / `designPath: null`, and its
`doctor` pass returns zero findings only because it doesn't audit files it no
longer reads. So the old file isn't "slightly stale"; it is orphaned.

**Truth drift on top of schema drift.** `.impeccable.md` still describes the
retired *editorial archive* direction (ink on warm ivory, colour rare and
accent-like). The shipped system in [shared/theme.css](shared/theme.css) is
**Broadsheet**: inverted type hierarchy (Libre Franklin pushed to black weights
as the loud display voice, EB Garamond as the quiet serif counter-voice),
colour spent as flat structural fields and heavy rules, cool near-white paper,
high contrast. Per the skill's own rule, the code is the design authority and
the document is just out of date.

**What still holds from the old file** (to carry into the new artifacts):

- Audience and product facts: academic audiences (DH, African/Islamic studies,
  history); projected in lecture halls; published offline-capable at
  slides.frederickmadore.com.
- The exact six-colour Bayreuth corporate palette as a pinned constraint.
- The anti-references list (rainbow spectrum bar, compass motif, tinted
  takeaway boxes, per-slide green eyebrow + tick-rule, drop-shadowed cards).
- The bar: authored by a historian, never reads as AI-generated.
- Everything self-hosted and offline (fonts vendored via
  `tools/fetch-fonts.py`).
- Credit the author, not the institution — Bayreuth/Africa Multiple is an
  affiliation, never the masthead credit.

**Repo realities that shape the plan:**

- The theme is authored in modules — `shared/src/theme/01-foundations.css`
  through `09-flow-motion.css` — and built into `shared/theme.css` by
  `npm run build:shared`. Design edits go to `shared/src/theme/`, never to the
  built file.
- All five published talks (May–July 2026) share the one theme, so any
  system-level change ripples into already-delivered archives. The guard is
  `tools/visual-diff.mjs`: a before/after screenshot comparison (via
  `tools/browser-check.mjs --screenshots DIR`), not committed baselines —
  so every design pass must capture its "before" arm first.
- `talks/_showcase/` exercises the full layout vocabulary and
  `talks/_template/` seeds every future talk — these two are the living
  design surfaces.
- The `slides` project skill owns deck authoring, validation and PDF export
  mechanics; Impeccable owns design quality. They complement, not compete.

---

## Phase 0 — Migrate to the v4.1.1 artifact set

*Status: ✅ COMPLETE 2026-08-17.*

1. ✅ **`/impeccable init`** → `PRODUCT.md` written. Confirmed in interview:
   hall-first audience priority; success = scholarly credibility + citable
   record; WCAG 2.2 AA binding.
2. ✅ **`/impeccable document`** → documenter agent derived `DESIGN.md` + the
   `.impeccable/design.json` sidecar from the shipped Broadsheet code.
   Confirmed inputs: North Star "The Scholarly Broadsheet"; role-led English
   colour names (Lead Green, Structural Navy, Gold Spark…); component
   philosophy "Ruled, not boxed"; flat-by-default elevation (shadows only for
   true overlays). Ten components documented, ten Named Rules. The `.kicker`
   green tick was kept as a legitimate occasional label — the banned tell is
   the *per-slide* eyebrow habit, not the component.
3. ✅ **`.impeccable.md` retired** — deleted; README references updated
   (design-philosophy paragraph + structure listing); `tools/audit.py`
   DEV_ONLY and `tools/test_strip_notes.py` fixtures now name `PRODUCT.md`,
   `DESIGN.md`, `.impeccable` instead.
4. ✅ **Config**: design-detector hook enabled (`.impeccable/config.json`
   committed; machine-local `.impeccable/config.local.json` gitignored);
   switch off with `/impeccable hooks off` if it proves noisy on ordinary
   content edits. `buildPath` is deliberately *not* recorded: this harness
   has no image-generation tool, so code-first is the only path and the
   skill stores nothing.
5. ✅ **Sanity checks**: `doctor` resolves both artifacts (platform web, zero
   findings); all 87 Python tests pass; `audit.py --strict` clean.
6. ✅ **`/slides` skill updated** (user-global, `~/.claude/skills/slides/`):
   `DESIGN.md`/`PRODUCT.md` named as design authority, step 7 now invokes
   Impeccable's `polish` command properly, detector-hook triage noted, and a
   hard rule added to re-run `document` after intentional theme changes.

Also update the Claude memory note that says "trust theme.css over
.impeccable.md" — after this phase the file no longer exists and DESIGN.md is
the reference.

## Phase 1 — Baseline evaluation (before changing anything)

*Status: ✅ COMPLETE 2026-08-17. Critique 28/36 · Audit 12/20 · Integrity FAIL.
Snapshot: `.impeccable/critique/2026-08-17T10-48-34Z__talks-showcase-index-html.md`.
Working notes: `scratchpad/baseline-fit-scales.md`, `scratchpad/phase1-verification.md`.*

**Headline result.** The Broadsheet system is genuinely authored — the retired
anti-references are all still retired, the dark-field register and the quote
slide are excellent, and follow-through (alt text, reduced motion, the TOC
modal, contrast on in-slide text) is real rather than claimed. The defects
cluster in two places: **the label tier is print-scaled while the hall is the
primary reader**, and **the dark-field flip was tuned for navy and never
re-checked against green**.

One correction to this roadmap came out of it: `colorize` had been listed as
deliberately excluded on the grounds that "the colour strategy is already
committed." That was wrong. The strategy is committed; its *execution* on the
green and warm fields fails WCAG AA, and the highest-confidence finding of the
whole phase is exactly that. `colorize` is now Pass 2.

Produce one prioritized findings list; change nothing yet.

1. **`/impeccable critique talks/_showcase/index.html`** — heuristic design
   review of the full layout vocabulary.
2. **`/impeccable audit talks/_showcase/index.html`** — technical checks:
   contrast on the green/navy fields (AA at projector distance), focus states,
   reduced motion, small screens, print/PDF fidelity.
3. **Mechanical detector** over the theme modules and the showcase (the
   `detect.mjs` invocation is printed at session start; don't hardcode the
   versioned plugin path).
4. **Capture the "before" screenshots**:
   `node tools/browser-check.mjs --screenshots <dir>`. Corrected 2026-08-17 —
   the flag captures the `_showcase` catalogue only (8 representative slides ×
   1280×720 / 844×390 / 390×844 = 24 PNGs), not every deck. That is the right
   baseline: it is exactly the set CI's visual-regression job compares, and the
   catalogue exercises the full layout vocabulary. The same run also validates
   all seven decks and reports each slide's auto-fit scale.

Triage the combined findings into: system fixes (theme modules), showcase/
template fixes, and per-deck fixes. That triage decides which Phase 2 passes
are actually needed and in what order — the sequence below is the default,
not a quota.

## Phase 2 — System-level refinement passes (shared theme)

One command per session, each mapped to the theme modules it touches. These
are *refinements*: Broadsheet is the committed world; every pass preserves its
identity.

Ordering revised 2026-08-17 from Phase 1's evidence. Each pass now carries the
specific findings it must close.

*Pass 1 (`typeset`) ✅ COMPLETE 2026-08-17.* The label voice was split in two by
distance rather than by component: `--fs-label` (1.05rem, tracking eased to
0.10em) for every in-canvas label that carries meaning, `--fs-footer` (0.80rem)
reserved for true chrome outside the scaled canvas. Table headers went from
11.5px to ~15.5px, code from 0.6em to 0.78em, and four off-ramp literals were
tokenised (including a `0.78rem` that sat *below* the chrome floor). Verifying
caught a real regression — the taller kicker pushed Erlangen #14 from ×0.905 to
×0.898, under the readability threshold — fixed at the source by tightening the
kicker's trailing margin, which is also the better typography: a bigger cap
needs less air beneath it, and the tighter gap binds the label to its title.
Net height is now roughly neutral while labels are ~30% larger. Recorded in
DESIGN.md as **The Hall Label Rule**.

*Pass 2 (`colorize`) ✅ COMPLETE 2026-08-18.* The diagnosis was one idea, not a
list of failures: `.on-dark` was a single mode serving three fields whose
luminance differs by more than 4×, and its values had been tuned on navy.
Measured against Paper, the navy field reaches 13.06:1 and the duotone ground
18.4:1 — room for a tonal ramp and for gold. The green field tops out at
**4.97:1** and the brown at 5.71:1, so past ~7% transparency Paper itself falls
under AA, and nothing else in the palette clears even 3:1 on green (gold 2.17,
gold-bright 2.71, amber 2.34, sky 2.28). So the dark fields became **two
registers**: a deep pole with the ramp and the gold spark, and bright fields
that spend Paper and nothing else and separate their tiers by weight instead of
alpha. Six `--ond-*` tokens carry it; `deck.js` mirrors the register onto the
footer and viewport as `data-field="deep"`, since both live outside the slide.

Measuring turned up two defects the baseline had not: the gold plate rule that
opens every green divider was sitting at **2.17:1** — the signature device,
mud on a beamer — and the ghosted section folio at **1.52:1**. Both were put to
the author: the green field's rule is now Paper (4.97:1), which makes gold
genuinely exclusive to the deep pole and sharpens the One Gold Spark Rule
rather than diluting it; the folio is now outlined rather than ghosted, which
carries full Paper contrast at almost no visual mass. Deepening `--green-field`
to rescue gold was rejected — it would have bought a still-dull 3.13:1 rule by
moving the brand plane a visible step darker.

The weak-beamer hairline was fixed at the ramp rather than per component:
`--line` 1.43 → 2.22:1, `--line-strong` 2.60 → 3.52:1 (so chip outlines, nav
buttons and plate borders clear the 3:1 WCAG asks of a component boundary), and
`--ink-faint` to 4.51:1 on `--sunken`, where it had been 3.97:1. Focus became
one `--focus-ring` token — green on light, Paper on every dark field — and
in-slide links got a themed ring for the first time. The `.media` scrim was
rebuilt as two crossed gradients plus a theme-owned footer band, and verified
against a worst-case pure-white frame at 18.8:1. Every dark-field pair now
passes; verified in the rendered catalogue, and the outlined folio and both
scrim layers survive the `?print-pdf` export path.

Two rules survived the first sweep and were caught by `document` re-deriving
the system from the code: `.dateline .dl-part` still keyed itself gold on
`.section` (2.71:1 on green) and the closing colophon's rule sat at 2.38:1.
Both now take the register. The remaining blanket Paper mixes on `.closing`
were measured and left alone — 6.05 to 11.24:1 on a field that is permanently
navy — as was the `.folio-ghost` watermark, which is decoration rather than
information and is recorded as such.

*Pass 3 (`harden`) ✅ COMPLETE 2026-08-18.* The pass found one theme with two
faces: rules that read correctly in the stylesheet but do not survive the
runtime. Hero centring was the clearest case — `.cover`, `.section`,
`.statement`, `.closing` and `.metric` all declared `justify-content: center`,
and reveal hard-sets `display: block` on the active slide, so the declaration
was inert and only `.balance` actually centred anything. Ten slides across all
seven decks had silently inherited the discrepancy. The hero list now wins at
`.present` specificity, and the same list is restated for `.pdf-page`, because
reveal's print re-parenting defeats `.present` a second way. `.balance` remains,
demoted to what it always claimed to be: an opt-in for *non-hero* sparse slides.

The two `62vh` caps were the same defect in a different register — a viewport
unit inside a canvas that reveal scales as a whole, so the same slide held a
different amount of image on a laptop, a hall projector and a phone. Both now
take `--block-max-h` (28rem: the 62vh they replace, measured at the 720px
reference height). The three surviving viewport units are the TOC panel and the
lightbox, which are true overlays outside the canvas and correct as they stand.

PDF export got a real imprint. One persistent footer is right on screen because
it updates as you move; on paper every page is final, and reveal was parking
that single footer at the tail of the last page still stamped with whatever
folio was current — one wrong number, sixteen blank pages. Each page now builds
its own imprint, in the screen footer's voice, inverting on dark pages through
the Pass 2 registers. A shared `fieldOf()` helper backs both, so a slide can
never be dark for the footer and light for the imprint.

`document` earned its keep a second time: the imprint set `data-field="deep"`
but was never *named* in the deep-register override list, and it hangs off
`.pdf-page` — a sibling of the section — so it inherited nothing and every dark
page silently rendered in the bright register. Legible, but the gold folio the
deep pole is owed never appeared. Naming it there fixed it (title 6.22:1, gold
folio 7.13:1 on navy), and the rule went from a 1px hairline to the footer's own
2px near-black, so the two really are one device rather than approximately one.

Two findings arrived from outside the brief. `tools/browser-check.mjs` already
meant to ignore third-party embed failures, but its exemption matched only
fetch errors, not a remote site refusing to be framed — so the gate failed
intermittently on `zmo.de`'s `frame-ancestors`, which says nothing about any
deck and depends on whether the runner has network. Confirmed pre-existing by
re-running against a stashed tree. And the engine builds its chrome by string
concatenation, so `escapeHTML()` now guards the deck title and venue.

The waiver review came back clean: all seven decks export one page per slide,
one imprint per page, no unclipped overflow — the eight `data-fit-allow`
waivers cost nothing at export. `.reveal pre code` already carried
`display: block`; that one was closed earlier, in Pass 1.

**Found, not fixed** (it needs an author-copy decision, so it was reported
rather than decided): `.scroll-panel` truncates silently mid-sentence in PDF,
and the authored `.scroll-hint` line still tells the reader to scroll. Fixing
it properly means either expanding the panel in print or rewording per-deck
copy.

*Pass 4 (`layout`) ✅ COMPLETE 2026-08-18.* The `.closing` finding turned out to
be one diagnosis, not five symptoms: the colophon had inherited hero measures
— a 16ch title and a 30ch lead — that were drawn for slides carrying a figure
beside the type. The closing carries nothing but type, so those measures stacked
a narrow column down the left third and left more than half the field empty,
*and* overflowed vertically. Widening them to 22ch/46ch and setting
`.byline.authors` as a row (contributors read across on a colophon; stacked is
right only under a cover title, where the byline is a caption) fixed both faces
at once. Erlangen went 658→384px of stack against 595 available, Paris
639→377, Luxembourg 671→590. All three `data-fit-allow="deliberate full-bleed
closing composition"` waivers are deleted; four of the five closings now render
at scale 1.0 and Luxembourg's at 0.960.

Two published decks were carrying an inline-styled wrapper
(`min-height:100%; display:flex; justify-content:center`) that hand-patched
reveal's `display:block` on `.present` — rhodes even documented it in a comment.
Pass 3 fixed that in the theme, so both wrappers came out; their closings left
the auto-fit list entirely.

The three smaller findings were each a near-miss rather than a gross error, and
that is what made them read as mistakes. `.marginnote` had no `margin-top`, so
under a chart its 3px rule sat flush against the last share-bar and read as a
seventh, unlabelled, near-black bar. `.toc-close` overlapped `.toc-head`'s box
at every viewport measured (1280×720, 844×390, 390×844, 1920×1080) — only the
word "Contents" being short kept the collision off the screen; the head now
keeps out from under the button while the rule still spans full width. And the
ledger's note sized itself by its own 60ch prose measure while the grid above it
sized by column, so two identical 3px rules stopped 32px apart; the note now
takes the ledger's column and the two edges are exact.

**One Phase 1 finding was withdrawn, not fixed.** "250–350px of unclaimed space
below 18 of 24 white slides" measured `_showcase`, whose slides carry
deliberately minimal placeholder copy to demonstrate layouts — slide 5's two
columns say "A point on the left" and "Another point". Measured on the real
published decks the figure is 1/17, 0/17, 4/22 and 0/18 slides with more than
120px of slack. Top-aligned content with a ragged bottom is the contract
(`.balance` is the opt-in for genuinely sparse slides), and it holds the slide
title in a constant position across a deck, which is worth more than a filled
canvas. Centring everything would have been the wrong fix to a measurement
artefact.

*TOC alignment follow-up 2026-08-18 (user-reported).* The contents rows looked
misaligned because they were: the overlay is mounted inside `.reveal`, so three
slide-prose rules reached it — a 56ch cap, a 1.5em list indent, and the green
bullet tick — leaving every row indented from the head's rule on the left,
stopped short of it on the right, and carrying a stray tick. The existing
`.toc-list` reset never applied: a bare `.toc-list` loses on specificity to
`.reveal ul`. Two more came out of measuring it: `.toc-panel` was `content-box`,
so `width: min(92vw, 60rem)` sized the content and the padding was added on top
— a 423px panel on a 390px phone with the close button off-screen, and 1062px
on desktop where 60rem was the stated intent; and the dotted leader sat 0.32em
up, at about 60% of the x-height, reading as a rule laid across the row rather
than a line running along it (now 0.12em, just above the shared baseline).

The numerals were *not* misaligned — `align-items: baseline` was doing its job,
confirmed by probing each cell with a zero-size inline-block strut, which lands
exactly on the line's baseline. An earlier canvas-metrics measurement had
suggested three different baselines; it was comparing the ink tops of digits
against mixed-case text and was simply wrong. Worth remembering: for baseline
questions, probe the layout, don't measure the glyphs.

*Pass 5 (`polish`) ✅ COMPLETE 2026-08-18.* Two of the four findings were the
system caught breaking its own rules. `.flow-step` was three bordered radiused
boxes joined by arrows — on the slide captioned "A process, drawn — not
bulleted", which Phase 1 called the one composition an unrelated product could
ship unchanged. It now opens on the same heavy rule `.panel` uses, with the
gutter doing the separating and the direction marks seated on the rule band.
`.reveal pre` dropped its hairline to become the flat Sunken inset the system
already sanctions as its only surface. Neither needed a new idea — both needed
the rule already written down.

`transition: all` is gone from the theme. It had been sweeping in
`outline-color` and `outline-offset`, so the focus ring — the one Pass 2 spent
a whole pass making AA-compliant — faded up over 220ms instead of appearing when
focus landed. Three interactive elements now list exactly what they animate.

The right-aligned table header turned out **not** to be the trailing
letter-space Phase 1 diagnosed. Measured, the header ink and the numeral ink sat
4.6px apart because `padding: 0.55em 0.9em` resolves against each cell's own
font-size — 12.4px inside a 0.82em header, 17.0px inside a full-size body cell.
The horizontal padding now resolves against the table's font-size and the two
ink edges land on 1186.2 exactly. Tracking was a red herring; two font sizes
sharing an em-based padding was the defect.

**The fourth finding is not a theme defect and was not fixed.** The roadmap
recorded "the identical green kicker+bar opener on 9 of 24 slides", which is the
catalogue. Counted across the repo the opener runs on 88%, 89%, 79%, 64% and 66%
of slides in the five published decks — against 37% in `_showcase` and 25% in
`_template`. So the living surfaces are the restrained ones, and the retired
anti-reference — "a per-slide green eyebrow + tick-rule", named in PRODUCT.md as
a tell not to resurrect — is alive in the authored archive. The components are
correct; the habit is editorial. Published decks are archives and the kicker
text is authored copy, so this is the author's call, not a pass's.

Two smaller things came along: the `mark`/`.hl` wash had 1.4px of side padding
and stopped flush against the first and last glyph (a highlighter overshoots the
word it marks), and the footer was a plain div — it now carries
`role="contentinfo"` with a real `<nav>` inside it.

*Pass 6 (`animate`) ✅ COMPLETE 2026-08-20.* Two of the three findings held and
the third was half wrong, which measuring settled before any code moved. The
signature does run on the layout path — but the roadmap's "`transform:
scaleY/scaleX` is a drop-in" is only true of the share bars. On the column
chart each bar's value numeral is laid out *on top of* the growing fill, so the
`height` is what carries the numeral up with its bar (447px → 247px on the peak
bar); scaling instead would strand all eight numerals at their final height
while the bars rose to meet them. Isolated with CDP performance counters, the
growing bars cost 36 layouts / ~28ms against 52 layouts / ~40ms for the
count-up running beside them — so the conversion would have bought back about a
third of a cost that stays either way, and paid for it with the authored
detail. Put to the author, who kept the ride. The share fill converted, and did
not need a keyframe of its own: it is a rule whose length is the number, so it
now draws on the same `rule-draw` `scaleX` as the marker bars, the kicker ticks
and the plate rules — `grow-right` is deleted and one motion idea covers five
of the six marks.

The opt-out finding was the larger one and it generalised. `.no-draw` did not
merely cover "a smaller set than the print stiller": there were **three** stiller
lists in three different selector grammars, and a fourth condition
(`prefers-reduced-motion`) blanket-killing durations from outside. Deck-level
`.no-draw` reached the title bar and kicker tick but not the charts; slide-level
`.no-draw` reached the charts but not a section divider's own plate rule; and
neither reached the counting numerals at all, because those live in `deck.js`.
All four now throw one switch: every signature animation takes its duration from
`--draw-run`, and print, the `?print-pdf` preview, reduced motion and `.no-draw`
each set that one property to `0s` (a zero duration with `both` fill lands each
mark on its end state — verified in the runtime, not assumed from the spec).
`deck.js` reads the same property off the slide before starting a count, so the
JS half can no longer still a different set of things than the CSS half; the one
condition it adds is the hidden tab, which CSS cannot express.

Progressive disclosure was already half closed — the broken `highlight-green`
recipe was fixed in an earlier pass and `_showcase` now explains entrance
against emphasis properly. What remained was that `_template`, which seeds every
future talk, demonstrated none of it. The author chose to seed a stepped list,
so the scaffold's content slide now carries `.fragment` on its three items with
a comment saying when to delete them. Verified in the print view: all three
render at full opacity, so a scaffolded deck still exports complete.

**Two findings came from measuring rather than from the brief, and both were
motion that had been written down and never actually ran.** The theme declares
`.reveal-viewport { transition: background-color 360ms }` for the cross-fade
between the paper ground and the graphite one — and reveal writes
`transition: transform 0.8s` *inline* on that same element while it initialises.
An inline declaration outranks any stylesheet rule, so the fade had never
happened once: the frame around the canvas cut instantly between near-white and
near-black on every section divider while the slide it surrounds faded. It is
the Pass 3 defect in a new place, and the override carries the theme's only
`!important` outside a stiller. And the reduced-motion answer was a blanket
`*{ transition-duration: 0.001ms }`, which reads as thorough and was not: it
turned that same cross-fade into a hard full-screen luminance cut for the
audience least able to take one. Reduced motion now removes displacement — the
TOC panel and lightbox figure stop travelling and fade in on opacity alone,
`.fade-up` stops rising, the button press-lift and the TOC hover slide go, the
progress bar jumps — and leaves every colour and opacity change at its authored
timing.

One more came along with the template change: reveal ships
`.reveal .fragment { transition: all .2s }`, the exact declaration Pass 5 removed
from the theme and wrote a rule against. It reaches any fragment that can take
focus, so `.reveal .fragment` now names the four properties reveal's fragment
vocabulary actually moves.

The end states are untouched: `visual-diff` reports 0.00% across all 24
catalogue screenshots, every deck's auto-fit scales are unchanged, and the
exported deck is still 19 pages with 19 imprints. Recorded in DESIGN.md as **The
One Stiller Rule**, **The Reduced Motion Keeps The Feedback Rule** and **The
Inline Style Wins Rule**, with the Ink-on-Paper rule rewritten to say why the
column chart is the one animation left on the layout path.

**Phase 2 is complete.** What is left is Phase 3 (per-deck QA, scaffold review)
and Phase 4 (cadence). The deferred list is unchanged, except that `distill`
now has one more candidate: `.no-draw` works correctly and is still used by no
deck.

| Pass | Command | Primary modules | Findings it must close |
|---|---|---|---|
| 1 | `typeset` | `01-foundations` | **[P0]** The label tier is print-scaled while the hall is the primary reader: `.stat-label`/`.bar-axis`/`figcaption` 12.8px, `table th` 11.5px, `pre code` 12.5px. Split the tier — keep 0.82rem for true chrome, add a hall tier ≈1.05–1.15rem (tracking eased to ≈0.10em) for labels that carry meaning. Also raise `.reveal pre` from `0.6em` |
| 2 | `colorize` | `01-foundations`, `04-chrome` | **[P1]** The dark-field flip was tuned for navy and never re-checked: `.on-dark` footer text 3.0–3.5:1 and `.foot-title` 2.7–3.2:1 on `--green-field` (need 4.5:1); focus ring `var(--green)` at 1.28:1 on the same field with no `.on-dark` counterpart; in-slide links get no themed ring at all (~1.5:1 browser default on navy). Also the weak-beamer hairline problem: `--line` is ~1.15:1 against paper and vanishes on a hazy projector, so "ruled, not boxed" degrades to floating text. Derive on-dark values per field rather than one blanket mix |
| 3 | `harden` | `06-responsive-print`, `03-layouts`, `05-embeds-code` | **[P1]** Two catalogue recipes break on copy (`fragment highlight-green` shows at index 0; `.metric`/`.cover` never centre because reveal forces `display:block` on `.present`). **[P1]** `62vh` inside the canvas at `03-layouts.css:177` and `05-embeds-code.css:11` breaks the Fixed Canvas Rule. PDF export carries no per-page imprint and one stray wrong folio. `.reveal pre code` lacks `display:block`, so padding lands on first/last line boxes only. Review the eight `data-fit-allow` waivers for export pagination |
| 4 | `layout` | `03-layouts`, `08-image-editorial` | The `.closing` layout does not fit a 720px canvas at authored size — waived in three decks with identical boilerplate, rendering the contact/QR slide at 84–89%. **[P2]** `.marginnote` has no `margin-top`, so its 3px rule reads as an unlabelled data bar under the chart. `.toc-close` overlaps `.toc-head`. Three different right edges in one region on the ledger slide. The 250–350px of unclaimed space below 18 of 24 white slides |
| 5 | `polish` | `02-components`, `04-chrome`, `09-flow-motion` | `.flow-step` and `.reveal pre` are bordered radiused cards against the system's own Ruled-Not-Boxed rule. `transition: all` on four interactive elements fades the focus ring in over 220ms. Trailing letter-space on right-aligned tracked headers. The identical green kicker+bar opener on 9 of 24 slides |
| 6 | `animate` | `09-flow-motion` | The signature animates `height`/`width` (layout properties) for 560ms — the one animation that will drop frames on a weak conference laptop; `transform: scaleY/scaleX` is a drop-in. `.no-draw` opt-out covers a smaller set than the print stiller. Progressive disclosure is the largest unused lever: 1 of 24 slides uses fragments, and that one is the broken recipe |

Deferred until a concrete need appears: `delight`, a data-viz pass on
`07-data-viz.css`, `extract`, `distill` (dead affordances: `.chrome-open`,
`.panel.sunken`, `.no-draw`, the duplicated `.site-frame`/`.chrome` component
family), `optimize` (the 132 KB logo painted at 18px on every slide; the
11.4 MB PDF).

**Deliberately not on the roadmap:** `bolder`/`quieter` (Broadsheet's register
is calibrated; changing it is a new-work decision, not a dial), `overdrive`,
`onboard`, `craft` (deprecated alias).

**The verify loop for every pass** (bounded, per the skill's own rule — one
batched inspection round, one fix batch, at most one confirm round, stop):

```bash
npm run build:shared
```
```bash
npm test
```
```bash
node tools/browser-check.mjs --screenshots after-<pass>
```
```bash
node tools/visual-diff.mjs --before before-<pass> --after after-<pass>
```

Review every flagged diff across all seven surfaces deliberately: intended
changes accepted, side effects on the archived decks fixed. Then export one
representative talk to PDF (`npm run export`) to confirm print parity. After a
material pass, the "after" screenshots become the next pass's "before".

## Phase 3 — Per-deck work

- **Published talks are archives.** They inherit system improvements through
  the shared theme, but get no individual redesign — QA sweep only.
- **`talks/_template/`** — after each Phase 2 pass, confirm the scaffold still
  demonstrates current best practice; it seeds every future talk.
- **Future talks** — authoring stays with the `slides` skill (manifest,
  scaffold, notes, export). Then, before the event:
  `/impeccable polish talks/<new-talk>/index.html`; add `critique` only when a
  deck breaks new layout ground.

## Phase 4 — Cadence and maintenance

- After any material theme change, rerun **`/impeccable document`** so
  DESIGN.md keeps describing the shipped system (the documenter derives from
  code, so this is cheap).
- Run **`/impeccable doctor`** after skill updates or when something feels
  stale; `npx impeccable update` handles tool-version drift separately.
- Keep the two-artifact discipline: never reintroduce a second free-form
  design document alongside DESIGN.md.

---

## Ground rules for every session

1. **Refinement preserves.** Broadsheet is the committed world. If a pass
   starts arguing for a different world, stop — that conversation belongs in
   `new-work`, deliberately, not by accretion.
2. **Code over documents.** `shared/theme.css` (built from `shared/src/theme/`)
   is the design authority; documents describe it, never override it.
3. **The brief wins.** Exact Bayreuth palette, self-hosted/offline, author
   credited over institution, and the anti-references stay banned.
4. **The bar is "authored by a historian".** Nothing that reads as a template
   or as AI-generated survives review.
5. **Bounded verification.** One batched inspection round, one fix batch, one
   confirm round — then stop polishing.
