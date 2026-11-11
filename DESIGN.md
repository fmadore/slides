---
name: Broadsheet
description: A bold scholarly broadsheet slide system — inverted type hierarchy, colour as flat structural fields, ruled not boxed.
colors:
  lead-green: "#009260"
  structural-navy: "#00268a"
  gold-spark: "#cca352"
  amber-highlight: "#f59c08"
  warm-brown: "#d57912"
  sky: "#44b8f2"
  green-deep: "color-mix(in oklch, #009260, #06140d 26%)"
  green-field: "color-mix(in oklch, #009260, #04140d 14%)"
  green-wash: "color-mix(in oklch, #009260, oklch(0.991 0.001 250) 90%)"
  navy-field: "color-mix(in oklch, #00268a, #03081c 8%)"
  navy-deep: "color-mix(in oklch, #00268a, #04060f 30%)"
  gold-bright: "color-mix(in oklch, #cca352, white 24%)"
  brown-deep: "color-mix(in oklch, #d57912, #140a02 44%)"
  warm-field: "color-mix(in oklch, #d57912, #160b02 30%)"
  duo-ground: "#04140d"
  browser-dot: "color-mix(in oklch, oklch(0.530 0.016 256), oklch(0.991 0.001 250) 25%)"
  code-title-blue: "color-mix(in oklch, #00268a, #44b8f2 18%)"
  scroll-thumb: "color-mix(in oklch, #009260, oklch(0.991 0.001 250) 18%)"
  gold-wash: "color-mix(in oklch, #cca352, white 18%)"
  scrim-ink: "oklch(0.14 0.02 258)"
  capture-letterbox: "#211f1d"
  paper: "oklch(0.991 0.001 250)"
  panel: "oklch(0.972 0.002 250)"
  sunken: "oklch(0.945 0.004 250)"
  line: "oklch(0.744 0.005 250)"
  line-strong: "oklch(0.623 0.010 256)"
  rule: "oklch(0.165 0.014 258)"
  ink: "oklch(0.205 0.016 258)"
  ink-bold: "oklch(0.150 0.016 262)"
  ink-soft: "oklch(0.405 0.018 258)"
  ink-faint: "oklch(0.530 0.016 256)"
typography:
  display:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "5.30rem"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.018em"
  headline:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "3.50rem"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.012em"
  title:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "2.20rem"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.014em"
  lead:
    fontFamily: "EB Garamond, Iowan Old Style, Georgia, Times New Roman, serif"
    fontSize: "2.00rem"
    fontWeight: 500
    lineHeight: 1.26
    letterSpacing: "-0.002em"
  body:
    fontFamily: "EB Garamond, Iowan Old Style, Georgia, Times New Roman, serif"
    fontSize: "1.52rem"
    fontWeight: 500
    lineHeight: 1.46
    letterSpacing: "0"
  label:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.005em"
  chrome:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.80rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.18em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Cascadia Code, SF Mono, Segoe UI Mono, Menlo, Consolas, monospace"
    fontSize: "1.02rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  sm: "3px"
  md: "5px"
  lg: "8px"
spacing:
  2xs: "0.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
  3xl: "4rem"
  block-max: "28rem"
components:
  slide-title:
    textColor: "{colors.ink-bold}"
    typography: "{typography.headline}"
  kicker:
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
  chip-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: "0.22em 0.6em"
  chip-solid:
    backgroundColor: "{colors.lead-green}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0.22em 0.6em"
  section-divider:
    textColor: "{colors.paper}"
    typography: "{typography.display}"
  closing-field:
    textColor: "{colors.paper}"
    typography: "{typography.display}"
  nav-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    size: "2rem"
  nav-button-hover:
    backgroundColor: "{colors.lead-green}"
    textColor: "{colors.paper}"
  flow-step:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "0.75rem 0 0"
  code-inset:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: "1.1em 1.3em"
  print-imprint:
    backgroundColor: "transparent"
    textColor: "{colors.ink-faint}"
    typography: "{typography.chrome}"
    padding: "0.5rem 0 0"
  print-imprint-rule:
    borderColor: "{colors.rule}"
  print-imprint-folio:
    textColor: "{colors.lead-green}"
    typography: "{typography.chrome}"
---

# Design System: Broadsheet

This file states the rules: what each is, its value, and the one-line reason. How a rule was found, what the system measured before a fix and the values it superseded are in [`docs/design-history.md`](docs/design-history.md), which is not required reading. The code (`shared/src/theme/`, `shared/src/deck/`) is the authority; this file tracks it.

## Overview

**Creative North Star: "The Scholarly Broadsheet".** Broadsheet is the visual system of a reveal.js engine for academic talks: an authored scholarly broadsheet, not a slide template. Three ideas carry it.

1. **Inverted type hierarchy.** The newspaper gothic (Libre Franklin, bold, lightly negative-tracked) is the loud display voice; the humanist book serif (EB Garamond) is the quiet voice for prose, leads and quotations.
2. **Colour is a field, not a sprinkle.** The six binding Bayreuth corporate colours are spent as flat structural planes and heavy rules.
3. **A crisp, high-contrast page.** Near-black ink on a cool near-white, with structure drawn by 3–4px rules rather than boxes.

The voice is authored by a historian and must not read as template-made or AI-generated (see [Visual tells to avoid](#visual-tells-to-avoid)). WCAG 2.2 AA is binding, and legibility in a lecture hall leads every sizing decision. The signature mark is the 4px green bar above the slide title; a slide carries one overline at most, and labels inside the canvas are in sentence case.

## Colors

The Bayreuth palette is hex-normative and the neutral ramp OKLCH-normative; do not convert either. Derived values are normative as their `color-mix(in oklch, …)` expressions (the divider is never raw `#009260`, the closing never raw `#00268a`). Nine are `:root` tokens; six are mixed inline in the one rule that spends them (browser-bar dot, code title blue, scroll thumb, highlighter wash, scrim ink, capture letterbox), so that no second, unmeasured user appears.

| Role | Token | Use |
|---|---|---|
| Lead Green | `--green` `#009260` | divider fields (as `--green-field`), title marker, list ticks, progress bar, chart bars, focus ring on light (3.87:1) |
| Green Deep | `--green-deep` | all small green text and links on light (6.12:1) |
| Structural Navy | `--navy` `#00268a` | `.closing`, `.section.navy`, share-bar fills, `.accent-navy` |
| Gold Spark | `--gold` `#cca352` | the deep pole's mark, through `--ond-mark` (gold-bright, 7.13:1 on navy); on paper only the `mark` wash and the statement quote mark |
| Amber | `--amber` `#f59c08` | minor highlight washes |
| Warm Brown | `--brown` `#d57912` | `.section.warm` and `.warm` variants; `--brown-deep` for small text |
| Sky | `--sky` `#44b8f2` | spent once: 18% mixed into navy for the highlight.js function token |
| Paper, Panel, Sunken | `--paper` … | slide ground; faint raised surface; insets, code, table stripes, chart tracks |
| Line | `--line` | hairlines, 2.22:1 on Paper |
| Line Strong | `--line-strong` | chip, nav-button and plate borders, 3.52:1 (WCAG 3:1 for a boundary) |
| Rule | `--rule` | heavy near-black editorial rules, 18.71:1 |
| Ink tiers | `--ink`, `--ink-bold`, `--ink-soft`, `--ink-faint` | text; Ink Faint is 5.15:1 on Paper, 4.51:1 on Sunken |

**The Field, Not Sprinkle Rule.** Colour arrives as a flat plane, a heavy bar or a solid fill, or not at all; never as a tint, gradient wash or scattered accent.

**The One Gold Spark Rule.** Gold reaches a dark field only through `--ond-mark` where it resolves to gold-bright. Never a second accent on a light slide, never hand-placed on a bright field.

**The Two Dark Registers Rule.** Nothing on a dark field is coloured by hand: six on-dark tokens (`--ond-text`, `--ond-quiet`, `--ond-chrome`, `--ond-mark`, `--ond-rule`, `--ond-mark-ink`) hold the colours, and their `:root` values are the bright register.

- **Deep pole** (`.section.navy`, `.closing`, `.media`; navy 13.06:1 against Paper, duotone ground 18.4:1): the tonal ramp reopens (quiet text 9.18:1, chrome 6.22:1, rules and control borders 3.05:1) and the mark is gold-bright.
- **Bright fields** (green divider 4.97:1, brown 5.71:1): Paper only. Past about 7% transparency Paper falls under 4.5:1, and no palette colour clears 3:1 on green (gold 2.17, gold-bright 2.71, amber 2.34, sky 2.28), so tiers separate by weight (600 against 700), never by alpha.

`03-toc-sync.js` mirrors the register onto the footer and viewport as `data-field="deep"`. One helper owns the question: `fieldOf(el)` returns `null`, `"bright"` or `"deep"`, read by both the live chrome (`update()`) and the print imprint (`buildPrintImprints()`). A new surface over a slide asks `fieldOf`.

## Typography

| Voice | Face and setting | Use |
|---|---|---|
| Display | Libre Franklin 700; 5.30rem cover, 6.10rem section, 5.60rem statement; line-height ≤ 0.98; −0.018em | cover, divider and closing titles, statements |
| Numerals | Libre Franklin 800; metric 9.50rem `--fs-mega` (−0.035em), stat at `--fs-h2` | the only display text still at 800 |
| Headline | 700, 3.50rem, line-height 0.98, `--track-tight` −0.012em, max 22ch | `h2.slide-title` |
| Title | 700, 2.20rem, −0.014em | `h3`, index titles |
| Lead | EB Garamond 500, 2.00rem, line-height 1.26, max 30ch | `.lead`; `h4` is serif 600 at this size |
| Body | EB Garamond 500, 1.52rem, line-height 1.46, max 62ch | prose, set large for the serif's small x-height |
| Label | Libre Franklin 700 (stat label 600), 1.15rem `--fs-label`, `--track-case` 0.005em, sentence case | every label inside the canvas |
| Chrome | 700, 0.80rem `--fs-footer`, `--track-label` 0.18em (runhead 0.22em), uppercase | footer, running head, TOC button and eyebrow, print imprint, Excerpt band, `.site-qr` label |
| Mono | JetBrains Mono 500, line-height 1.5, no tracking, never uppercase | code (1.02rem measured), scroll-panel excerpt, frame-bar URLs, document references |

Ordered lists and `.index-list` number plainly (`1, 2, 3`); only the footer counter, a running folio, keeps leading zeros (`01 / 17`).

**The Inverted Hierarchy Rule.** h1–h3 are Libre Franklin 700 with negative tracking; prose, leads, quotations and captions are EB Garamond. Never swap them.

**The Serif h4 Rule.** `h4` stays in the serif: an emphatic lead, not a label.

**The Hall Label Rule.** Labels split by distance, not by component. A label inside the canvas that says what a figure counts, which decade a bar sits in or what a column holds is set at `--fs-label` in sentence case with `--track-case`, and the author types it in sentence case. Tracked uppercase is chrome only: the theme's seven `text-transform: uppercase` rules are all chrome. `--track-hall` (0.10em) survives only for per-deck CSS. Test: cover the numerals and read the labels from the back of the room.

**The One Overline Rule.** A slide carries at most one line above its title. The engine's running head names the section on content slides; a slide with a `.kicker` or `.dateline` hides it (`update()` in `03-toc-sync.js`), and heroes never show it. The kicker has no tick: the title marker is the slide's one mark. Add a kicker only when this slide needs a label the running head cannot give.

**The Third Face Is Pinned Too.** `tools/fetch-fonts.py` vendors JetBrains Mono, italic included because highlight.js sets comments in it. The rest of the stack is a fallback for a failed load, not a choice.

## Layout

The canvas is a **fixed 1280×720 stage, uniformly scaled** by reveal: fixed rem on a 16px root inside it, never viewport-fluid. Only chrome outside the canvas uses `clamp()` and media queries (`max-width: 640px` compacts chrome; `max-height: 560px` reserves a footer strip). Each slide is a padded column (3.8rem top, 4.8rem sides, footer clearance), flowing from the top, on a 4pt-derived spacing scale. Measures: body 62ch, lists 56ch, leads 30ch, slide titles 22ch, cover title 18ch. Columns: `.cols` (equal, `ratio-3-2`, `ratio-2-3`, `ratio-1-2`; 4rem gutter).

**Hero centring is the theme's.** One rule at `.present` gives `.cover`, `.section`, `.statement`, `.closing`, `.metric`, `.center` and `.balance` `display: flex !important; flex-direction: column; justify-content: center` (reveal writes `display: block` inline). The list is restated for `.pdf-page > section` and `.scroll-page-content > section` in `01-foundations.css`. **Edit the three lists together.** `.balance` is for sparse non-hero slides.

**Every view that re-parents the slide restates the column** (print, scroll view) verbatim, with `display` left un-`!important` so non-hero slides stay block boxes.

**The closing is the one exception to the measures:** title 22ch, lead 46ch, because it is all type. Widen a measure only for an all-type composition the fit check proves.

**Ragged bottoms are the contract.** A title in a constant position is worth more than a balanced slide. The showcase's slack is placeholder copy, not evidence.

**The Fixed Canvas Rule.** No vw, vh or `clamp()` for slide content; figures and code cap at `--block-max-h` (28rem). The sanctioned viewport units are on true overlays only: the TOC panel (`90vh`) and the lightbox (`88vh` / `80vh`).

**The Floating Control Clearance Rule.** A control floating over a panel insets the panel's text by its box plus a gap; the rule beneath stays full width (`.toc-head { padding-right: calc(2.4rem + var(--space-sm)) }`).

**The Chrome Is Not Prose Rule.** Furniture inside `.reveal` states its own list, measure and marker at `.reveal`-qualified specificity (`.reveal .toc-list`).

**The Border-Box Chrome Rule.** Chrome that declares a width against the viewport sets `box-sizing: border-box` in the same rule; only the canvas has it.

## Elevation & Depth

Flat by default; depth comes from rules, the tonal neutrals and the fields.

| Shadow | Value | Only on |
|---|---|---|
| `--shadow-2` | `0 4px 14px oklch(0.2 0.02 258 / 0.10), 0 14px 40px oklch(0.2 0.02 258 / 0.12)` | `.chrome`, `.site-frame`, `.demo-shot`, `.site-qr` |
| `--shadow-pop` | `0 22px 60px oklch(0.16 0.03 258 / 0.30)` | TOC panel, lightbox image |
| inset, inline | `inset 0 6px 14px -12px oklch(0.2 0.02 258 / 0.5)` | `.scroll-panel` alone: it marks a cut edge in place of a border |

**The Overlay-Only Shadow Rule.** An outer shadow only on an element that floats above the deck; never on callouts, stats, panels, columns or other in-flow content.

## Shapes

Sharp by default. Radii: 3px (`--radius-sm`) chips, plate images, focus corners; 5px (`--radius-md`) TOC panel, code, sunken insets; 8px (`--radius-lg`) the browser frame only. Bars and ticks take 1px; the scrollbar thumb, browser furniture, takes a pill. Images are sharp plates with a 1px Line Strong border; full-bleed media has none.

**The Ruled, Not Boxed Rule.** Rules open, hairlines divide, a left bar marks the active choice. The only surface is the flat Sunken inset (`.panel.sunken`, `.reveal pre`, `.scroll-panel`), with no border. `.flow-step` and `.panel` open on the same 4px (`--bar`) Rule and are separated by the gutter.

**One run, one opening rule.** In a run of callouts only the first opens on the 3px rule; `.callout + .callout` takes a hairline.

**The Rule Opens From Above Rule.** A heavy opening rule needs air above it (`.marginnote`: `margin-top: var(--space-lg)`, 0 as a first child).

**The Rules Line Up Or Clearly Don't Rule.** Adjacent copies of one device end at the same x or differ obviously: `.stat-grid + .callout` takes the ledger's column width, while a standalone callout keeps 60ch.

## Components

**Slide title.** Headline voice under a 2.6rem × 4px Lead Green marker (1px radius, `padding-top: calc(4px + 1rem)`) that draws in from the left; `.no-rule` drops it.

**Kicker.** Optional overline: label voice, Ink Soft, `--space-xs` beneath, no tick. `.warm`, `.navy`, `.green` tint it; on `.closing` and in the `.media` caption it takes `--ond-mark`. It hides the running head.

**Running head** (engine). The current section in chrome caps, no rule beneath; hidden on heroes and on slides with a `.kicker` or `.dateline`.

**Callout.** 3px Rule on top, no fill, serif at `--fs-small`, max 60ch, a `.callout-label` in the label voice. `.warm`/`.navy`/`.green` tint rule and label.

**Stat and ledger.** `.stat`: an 800 numeral at `--fs-h2` over a label (600). `.stat-grid`: two columns of label left, green-deep figure right (`--fs-h3`) on hairlines, each column opened by a 3px rule; `data-count` rolls the figures.

**Index list.** 3px rules top and bottom, hairlines between rows; each row a plain green-deep numeral (700, `--fs-lead`), a title (700, `--fs-h3`) and an optional serif description.

**Chip.** Transparent, 1.5px Line Strong border, 3px radius, label voice, Ink Soft, padding 0.22em 0.6em; `.green`, `.navy`, `.warm`, `.solid` (green fill).

**Section divider.** `--green-field` with a 4px `--ond-mark` plate rule, a display title (6.10rem, Paper, line-height 0.94, max 16ch) and an optional italic `.sec-sub` in `--ond-quiet`. `.sec-no` is an optional quiet label above the title (label font 700, `--fs-h3`, `--ond-quiet`); a divider is complete without it. `.navy` is the deep pole; `.warm` (brown) is used sparingly.

**Statement.** Display claim (5.60rem, max 18ch) with one green-deep `.accent`; `.quote` returns to serif italic (500, line-height 1.08) after a gold quote mark.

**Closing.** `--navy-field` with a 4px `--ond-mark` plate rule; title at `--fs-h1` to 22ch, lead in `--ond-quiet` to 46ch. Here only, `.byline.authors` reads across (row, wrap, `--space-xl` gap, each `.author` max 34ch, logos pushed to the block foot). Links, kicker, contact icons take `--ond-mark`; names `--ond-text`, affiliations `--ond-quiet`; monochrome logos invert to white at 85% (`.keep-color` opts out).

**Institution logo.** `.org-logo` on cover and closing is 2.5rem tall and always follows the byline: an affiliation, never the credit or publisher slot. The footer's cluster mark is 1.4rem.

**Deck nav button.** 2rem square, 3px radius, 1.5px Line Strong border, Ink Soft icon; hover fills Lead Green and lifts 1px; focus 2px `--focus-ring` at 2px offset; disabled 30%. On dark: 10%-Paper fill, `--ond-rule` border, `--ond-text` glyph, hover to `--ond-mark`. The footer is `role="contentinfo"` with its controls in a labelled `<nav class="deck-nav">`. Copy-link announces success and shows a tick for 2.4s.

**Print imprint** (`.pdf-imprint`). In print the live footer and running head are hidden and `buildPrintImprints()` (`02-chrome.js`) adds one imprint per `.pdf-page`: chrome voice, a 2px Rule above, title and venue left, folio right. On paper: title Ink Faint (5.15:1), folio green-deep (6.12:1). On dark pages it reads `fieldOf()` and the on-dark tokens, and is named in the deep-register list in `01-foundations.css` because it is the section's sibling (deep pole: title 6.22:1, gold folio 7.13:1, rule 3.71:1). It carries `print-color-adjust: exact`. Author strings go through `escapeHTML()`, as in all string-built chrome.

**Scroll view** (`?view=scroll`, alias `?view=reader`). Manual opt-in only (`scrollActivationWidth: null`). Slides keep their stage; the footer becomes a fixed identification band; counter, running head and contents overlay are removed; motion is stilled. Known gap: under `max-height: 560px` the band falls below the fold.

**Media field.** `.media-scrim` crosses two gradients (darkest stop above 0.85 alpha over `oklch(0.14 0.02 258)`) and `section.media::after` adds a footer band. Worst case, a white frame: Paper 18.8:1 on the band, 13.2:1 in the caption zone.

**Process flow.** `.flow-step` columns (`flex: 1 1 0`, `--space-xl` gutter) open on a 4px Rule: `.step-n` (600, label voice, navy), `.step-h`, a serif gloss, optional `.step-q` and `.step-vec` (mono on Sunken, no border). `.flow-arrow` sits on the rule band in green-deep; `.flow.tight` closes the gutter.

**Table.** No boxes or vertical lines: a label-voice header (Ink Bold) over a 3px Rule, hairlines, even rows on Sunken at 70% transparency, body at `--fs-small`, `.num` right-aligned with tabular figures; padding `0.55em calc(0.9 * var(--fs-small))`.

**Inline highlight** (`mark`, `.hl`). A gold wash (gold 18% toward white) from 58% height, square, with `padding: 0 0.2em; margin: 0 -0.14em` so the stroke overshoots the word.

**Progress bar.** 3px, Lead Green on a 22% ink track; on dark the fill takes `--ond-mark` and the track measures 1.61:1.

**Plate.** Photographs take the green duotone (`#duo-green`; navy variant) on `#04140d`, a Line Strong border and a ruled caption (`.fig-no` in green-deep, italic gloss). App captures keep true colour in `.chrome` (8px, shadow-2), letterboxed on `#211f1d`. `.figrow` shows figures whole; `.crop` bleeds a photo.

**Live frame** (`.site-frame`). A chrome bar (`.site-frame-url` in mono, a `.site-frame-open` link) over `.site-frame-view` holding an `<iframe>` or a saved image. Live sites are **shown directly**; there is no opt-in control.

- A frame with no fallback of its own gets an engine notice (`div.frame-fallback[data-frame-notice]`, "Loading the site…"). It hides when a no-cors reachability request succeeds; if the site is unreachable, offline or still pending at 8 s it becomes the unavailable notice with a persistent "Open the site ↗" link.
- An author's saved view (`<img class="frame-fallback">`) stays until the embed sends its `data-ready-message` (origin- and source-checked), or until the iframe's `data-frame-trusted` is empty or equals the page origin and the site is reachable. A load event is never evidence.
- Every `.site-frame-open` opens a new tab; `audit.py` enforces it.
- A site that refuses framing from an origin (as `islam.zmo.de` does from localhost) legitimately stays on its saved view there.

**Editorial ornaments: use sparingly.** `.dateline`, `p.dropcap`, `.folio-ghost` and `.colophon` stay in the theme for decks that use them, but none belongs on an ordinary slide; the showcase shows them only on an uncounted annexe slide. A `.dateline` counts as the slide's overline. (`.marginnote` is a working component.)

**Readable evidence.** Pair a native extract with the complete, zoomable source; label date, unit and limits; never turn an incomplete distribution into shares of a whole. `.evidence-pair` sets source and transcription in ruled columns; `.evidence-reference` holds the whole source under a reading; `.evidence-reading` is a `<dl>` of type, value and context, with the limit in a separate callout. Reading editions (`read.html`) keep the faces, tokens and rules in normal document flow, without the fixed canvas or auto-fit.

## Motion and interaction

**The Ink-on-Paper Motion Rule.** `--draw: 560ms`, ease-out-quint: rules draw in from the left, chart bars grow, figures count up (`--count: 900ms`). One keyframe, `rule-draw` (`scaleX`), serves three marks (title marker, section and closing plate rules) and the share-bar fill. Only the column chart animates a layout property (`height`), so each numeral rides its bar.

**The One Stiller Rule.** Every signature animation takes its duration from `--draw-run`; print, `?print-pdf`, reduced motion, the scroll view and `.no-draw` set it to `0s`. `deck.js` reads it before a count and skips counts in a hidden tab; `tools/browser-check.mjs` proves the switch reaches every mark.

**The Reduced Motion Keeps The Feedback Rule.** Under reduced motion every displacement goes; colour and opacity changes keep their authored timing.

**The Themed Focus Rule.** `--focus-ring` is `--green` on light and Paper on dark fields, with a `var(--radius-sm)` corner on `.deck-btn`, `.toc-item`, `.is-zoomable` and in-slide links.

**The Focus Ring Is Not Animated Rule.** Every transition names its properties; `transition: all` appears nowhere. `.reveal .fragment` restates reveal's `transition: all` as `opacity, color, transform, visibility`.

**The Inline Style Wins Rule.** Before overriding a vendor property, check whether the vendor sets it inline (the `.reveal-viewport` cross-fade needs `!important`).

**Links and scroll regions.** In-slide links keep an underline at rest (1.5px, own colour at 50%, offset 0.16em): green against ink is 1.4–2.9:1, under the 3:1 at which colour alone may mark a link. Contact rows, the frame bar's Open link and the frame notice's link are excepted. `.scroll-panel` is a focusable named region (a deck's own scroller opts in with `data-scroll-region`); it takes only the vertical arrows.

## Further named rules

**The Two Image Treatments Rule.** Every image is a duotone plate with a ruled caption or a true-colour capture in browser chrome. No naked JPEGs.

**The One Bar Rule.** `.site-frame-bar, .chrome-bar` is one device declared once in `05-embeds-code.css`; it neutralises caption styling so it spans the frame whatever element carries it. Only the Open link is the live frame's own.

**The Padding Measures The Container Rule.** A gutter that must align across type sizes is measured against the container, not each cell's em.

**The Paper Cannot Scroll Rule.** A `.scroll-panel` prints what fits, fades into Sunken, closes on the heavy rule and carries an `Excerpt` band (`Extrait` in French) naming its `data-source-url`. `--excerpt-mark` and `--scroll-hint-display` are set for `@media print` and the `?print-pdf` preview.

**The Scrim Guarantee Rule.** A dark ground the theme does not own is manufactured; a new overlay-on-image pattern states its contrast against a worst-case white frame.

## Visual tells to avoid

The visual counterpart of the anti-slop list in the slides skill's `writing.md`.

- Stacked overlines: a kicker under a running head, or eyebrow, kicker and dateline on one slide.
- Tracked-uppercase labels inside the canvas.
- A heavy rule on every block, including each callout in a run.
- Outlined or ghosted numerals, and leading zeros used as decoration.
- Em-dash slogan titles ("X — and why it matters") and slogan kickers.
- Colophon-style credits on an ordinary closing.
- An italic serif subtitle under every heavy title.
- An institution logo missing, or in the credit slot above the presenter.
- The retired tells: the 6-colour rainbow bar, the compass motif, tinted key-takeaway boxes, a per-slide green eyebrow with a tick rule, drop-shadowed rounded cards.

## Do's and Don'ts

**Do:** put the green marker above every standard title; spend colour as fields and use the deep variants for small text; colour dark fields through the on-dark tokens and `fieldOf()`; keep display at 700 and `h4` in the serif; type labels in sentence case and give a slide one overline at most; centre heroes with the seven classes and add a new one to all three lists; cap figures with `--block-max-h`; open steps and panels on the 4px rule with air above; name every transitioned property and still motion through `--draw-run`; theme focus with `--focus-ring`; show live sites directly with a saved view and a new-tab Open link; step a list with `.fragment` only when the room should be walked through it.

**Don't:** resurrect any visual tell above; shadow in-flow content or border the Sunken inset; use viewport units in the canvas; centre a hero with `.balance`; build chrome from author strings without `escapeHTML()`; put gold on a light slide or gold, amber or sky on a bright field; carry a large form on a low-opacity fill; waive the fit check with boilerplate or widen `.lead` past 30ch outside `.closing`; write `transition: all` or zero every duration for reduced motion; leave an instruction in print the reader cannot follow; reach for an ornament on an ordinary slide; convert the OKLCH neutrals or "correct" the corporate hex.

## Where a deck writes its own CSS

`tools/audit.py` checks every `<style>` block and `style=""` under `talks/` and fails CI on eight rules: viewport units or `clamp()` in the canvas; `transition: all`; a shadow on in-flow content; the retired card (fill, hairline and radius); type under `--fs-caption` in the canvas or `--fs-footer` in the chrome; a corporate hex where a token exists; hero centring the theme owns; an animation not timed by `var(--draw-run)`. The landing page and 404 get the two rules that hold on any page (`transition: all`, hand-spelled corporate colours outside a `:root` palette). Each check carries a known-bad fixture. Measure contrast by painting a colour and reading the pixel back, against the threshold that applies (`--green` at 24px/700 is large text: 3.87:1 passes 3:1). Measure, register and whether a slide reads as authored are judged by eye.

## Brand skin: ZMO

A talk for the Leibniz-Zentrum Moderner Orient (ZMO) can wear the ZMO skin, which reproduces the institute's PowerPoint template on the same engine. Its authorities are the ZMO Corporate Design Manual (2019) and `ZMO Powerpoint.pptx`; Broadsheet's Named Rules (ruled not boxed, inverted hierarchy, colour as fields, sentence-case labels) do not govern it. Judge a ZMO slide against the PPT.

**Isolation.** The skin lives in `shared/brands/zmo/`, built from `shared/src/brands/zmo/` by `tools/build-shared.mjs`, with its logos and Carlito. A deck links `zmo.css` after `theme.css` and `zmo.js` after `deck.js` and sets `<body data-brand="zmo">`; every rule is scoped to that attribute, and `theme.css`/`deck.js` never change for it. Start with `tools/new-talk.py --brand zmo` (copies `talks/_template-zmo/`).

**Geometry** (1280×720, 128px per inch): a 137px blue band with the extended-square motif and the white 32pt title (shrunk by `zmo.js` to one line, floor 20pt); text area x 64→1175, y 166→606; logo foot left; folio and `www.leibniz-zmo.de` at 9pt foot right. Calibri (Carlito fallback), 16pt body, 13pt in cards. **One left edge:** band title, lead, text and every box start at x 64.

| Token | Value | Role |
|---|---|---|
| `--zmo-blue` | `#143c73` | band, fields, headings, bold lead-ins |
| `--zmo-orange` | `#eb8241` | marks and labels on blue only (4.06:1 there) |
| `--zmo-orange-ink` | `#cf7239` | orange text on white and cards (3.43 / 3.05:1); the one departure from the PPT, whose orange is 2.69:1 on white |
| `--zmo-text` | `#1f2937` | running text |
| `--zmo-muted` | `#5b6573` | sources and captions (5.91:1) |
| `--zmo-card` | `#eef2f7` | card, step, cell and tier fill |
| `--zmo-on-blue-soft` | `#b8c2ce` | secondary text on blue (6.05:1) |
| `--zmo-blue-grey` | `#7d8a9c` | flow arrows, the quiet quadrant dot (3.51:1 on white, 3.12:1 on card) |
| `--zmo-radius` | `16px` | every box: cards, callouts, steps, pills, matrix cells, tiers |
| `--zmo-radius-frame` | `8px` | browser frames |

**Layouts.** `.cover` (A · Titelfolie), `.section` (C · Titelfolie weiß; `.sec-no` hidden), plain content slides (Titel und Inhalt), `.cover.address` as the closing (B · Titelfolie mit Adresse; never `.closing`, whose auto-fit reserve pushes the meta lines into the foot band) and `.brand-logo` (Startfolie Logo). `.cols` and `.flow` grow to the foot, a lone callout fills its column, a final paragraph drops to the bottom line, and `.stat-grid` keeps 24px below it.

**Balance.** A lone callout (and a `.matrix` callout) centres its content (`align-content: center`). In a `.cols.cards` row whose fullest card fills under 60% of its height, `zmo.js` (`balance()`) sets `--zmo-above` / `--zmo-below` on two zero-basis spacer pseudo-elements so every card's content sits the same height down, just above centre. Neither can grow a box or trigger auto-fit.

**Folio.** `zmo.js` (`stampFolios()`) writes `data-zmo-folio` per leaf slide in the engine's vocabulary (`01…N`; uncounted annexes `A01…`; hidden slides skipped; a vertical stack shares one number). It prints before the URL on content slides and dividers, not on the cover, closing, `.brand-logo` or `.media`, and in the PDF.

**Chrome.** No running head, rule or progress bar; the footer keeps only its navigation, hidden until a pointer or keyboard reaches it. Live frames follow the engine's contract unchanged: the notice hides once the site answers and stays, with its Open link, when the site cannot be reached. Type floor: frame-bar URL and Open, QR URL and card foot at `--fs-caption` (10pt); the foot URL and folio stay at 9pt.

**Components.** Contracts are in `zmo.css` § 7. Most have a working slide in `talks/_template-zmo/` (14 slides); the rest are used in `talks/2026-11-12-zmo-unit-pv/`. The slides skill's `references/deck-system.md` tabulates them.
