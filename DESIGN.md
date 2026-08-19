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
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.028em"
  headline:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "3.50rem"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.022em"
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
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.10em"
  chrome:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.80rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.18em"
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

## Overview

**Creative North Star: "The Scholarly Broadsheet"**

Broadsheet is the visual system of a reveal.js slide-deck engine for academic talks: a bold scholarly broadsheet, not a slide template. Its identity rests on the three rules the author wrote into the theme itself. First, an **inverted type hierarchy**: the newspaper gothic (Libre Franklin, pushed to its 700/800 weights with negative tracking) is the loud display voice, while the humanist book serif (EB Garamond) is the quiet counter-voice for body prose, leads and quotations — the reverse of a conventional academic deck. Second, **colour is a field, not a sprinkle**: the six binding Bayreuth corporate colours are spent as flat structural planes and heavy rules, never as a timid accent wash. Third, a **crisp, high-contrast page**: near-black ink on a cool near-white, with structure drawn by confident 3–6px rules rather than faint decoration.

The voice is authored-by-a-historian and must never read as template-made or AI-generated. The confirmed anti-references (retired tells): the 6-colour rainbow spectrum bar, the compass motif, tinted key-takeaway boxes, the per-slide green eyebrow + tick-rule, and drop-shadowed rounded cards. WCAG 2.2 AA is binding; hall-projection legibility leads every sizing decision (the serif body sits deliberately large because EB Garamond's small x-height reads small in a hall).

**Key Characteristics:**
- Inverted type hierarchy: loud gothic display, quiet serif prose
- Colour as full-bleed structural fields (green leads, navy is the deep pole, gold sparks the deep pole only)
- Two on-dark registers, split by measured luminance: the deep pole re-opens a tonal ramp and takes gold; the bright fields spend Paper and separate their tiers by weight
- Signature device: a heavy 4px green marker bar above every standard slide title
- Ruled, not boxed: hairlines and heavy editorial rules instead of cards
- Flat by default; shadows only on true overlays
- "Ink on paper" motion: rules draw in, bars grow, figures count up

## Colors

The exact six-colour University of Bayreuth corporate palette (binding, hex-normative) over a cool near-white/near-black neutral ramp defined in OKLCH (OKLCH-normative — do not convert).

### Primary
- **Lead Green** (`{colors.lead-green}`): the lead colour. Full-bleed `.section` divider fields, the marker bar above slide titles, list ticks, links, folios, the progress bar, chart bars. Darkened via `color-mix(in oklch, var(--green), #06140d 26%)` (`--green-deep`) for AA text and links on light backgrounds — never set small green text in the raw corporate hex.

### Secondary
- **Structural Navy** (`{colors.structural-navy}`): the structural deep pole. The `.closing` field, the `.section.navy` divider variant, share-bar fills, the `.accent-navy` text voice.
- **Gold Spark** (`{colors.gold-spark}`): the spark of the *deep* pole, reached through `--ond-mark`. That token resolves to `--gold-bright` (`color-mix(... white 24%)`, 7.13:1 on navy) on `.section.navy`, `.closing` and `.media`, and to Paper on the green and brown fields. It draws the `.section`/`.closing` plate rule, dark-field list ticks, the dropcap, the marginnote and dateline keys, the closing kicker, links and icons, the footer counter and the on-dark progress fill. On paper, gold survives only as the `mark` highlight wash and the oversized quotation mark of the statement quote.

### Tertiary
- **Amber Highlight** (`{colors.amber-highlight}`): minor supporting role; highlight washes.
- **Warm Brown** (`{colors.warm-brown}`): the warm "counter-thread" — `.section.warm` stakes divider, `.kicker.warm`/`.callout.warm` variants; darkened (`--brown-deep`) for AA small text on light.
- **Sky** (`{colors.sky}`): reserved corporate colour; smallest role, kept for palette fidelity.

### Neutral
- **Paper** (`{colors.paper}`): the page/slide background — cool, crisp near-white, not a warm-paper wash.
- **Panel** (`{colors.panel}`): faintly raised surfaces (TOC close button).
- **Sunken** (`{colors.sunken}`): insets, code blocks, table stripes, chart tracks.
- **Line** (`{colors.line}`): hairlines, re-spaced for the hall at 2.22:1 on Paper. At its former 1.43:1 it was a printer's hairline — present at 40cm, simply gone on a weak beamer, which quietly turned "Ruled, not boxed" into floating text. **Line Strong** (`{colors.line-strong}`): the borders that draw a control or a plate — chip outlines, nav-button borders, plate borders — at 3.52:1, clearing the 3:1 WCAG 2.2 asks of a component boundary.
- **Rule** (`{colors.rule}`): the heavy near-black editorial rule (3px dividers, callout tops, table header rules, footer/runhead rules).
- **Ink** (`{colors.ink}`): primary text. **Ink Bold** (`{colors.ink-bold}`): big display headlines. **Ink Soft** (`{colors.ink-soft}`): secondary text. **Ink Faint** (`{colors.ink-faint}`): tertiary text, captions, chrome — 5.15:1 on Paper and 4.51:1 on `Sunken`, which is where code line numbers and zebra rows actually put it.

### Named Rules
**The Field, Not Sprinkle Rule.** Colour arrives as a flat structural plane (a full-bleed divider field, a heavy marker bar, a solid fill) or not at all. Never as a timid tint, gradient wash, or decorative accent scattered across a light slide.

**The One Gold Spark Rule.** Gold is the spark of the deep pole, not of "the dark fields". It reaches a dark field only through `--ond-mark`, and only where that token resolves to gold-bright. It is never a second accent competing with green on a light slide, and never hand-placed on a bright field.

**The Two Dark Registers Rule.** (Supersedes the former Dark-Field Flip Rule.) The dark fields are two registers, split by measured luminance against Paper, and nothing on a dark field is coloured by hand: it is coloured by the six on-dark tokens — `--ond-text`, `--ond-quiet`, `--ond-chrome`, `--ond-mark`, `--ond-rule`, `--ond-mark-ink` — whose `:root` values *are* the bright register, so any dark surface is safe without opting in.

- **Deep pole** (`.section.navy`, `.closing`, `.media`; navy 13.06:1 against Paper, the duotone ground 18.4:1): a selector block immediately after `:root` re-opens the tonal ramp — quiet text at 18% transparency (9.18:1 on navy), footer chrome at 35% (6.22:1), rules and control borders at 55% (3.05:1) — and hands the mark to gold-bright.
- **Bright fields** (the green divider at 4.97:1, the brown `.section.warm` at 5.71:1): they spend Paper and nothing else. Past roughly 7% transparency Paper itself falls under 4.5:1, and no other palette colour clears even 3:1 on green (gold 2.17, gold-bright 2.71, amber 2.34, sky 2.28). Tiers therefore separate by **weight** (600 against 700), never by alpha.

The footer and the viewport live outside the slide and cannot inherit the register, so `shared/src/deck/03-toc-sync.js` mirrors it onto them as `data-field="deep"`. **One helper owns the question.** `fieldOf(el)` in that same module returns `null` on a paper slide, `"bright"`, or `"deep"`; the live chrome (`update()`) and the printed imprint (`buildPrintImprints()`) both read it, so a slide can never be dark for one surface and light for the other. Any new surface that has to sit over a slide asks `fieldOf`, it does not re-derive the answer from class names. Never leave ink-coloured emphasis on a dark field, and never open a new alpha tier on a bright one.

## Typography

**Display Font:** Libre Franklin (variable, self-hosted; system-ui fallback)
**Body Font:** EB Garamond (variable, self-hosted; Iowan Old Style / Georgia fallback)
**Label/Mono Font:** Libre Franklin for uppercase labels; JetBrains Mono (ui-monospace fallback) for code

**Character:** The hierarchy is deliberately inverted — the newspaper gothic is the LOUD voice (big, tight, weight 700–800, negative tracking down to −0.03em), and the book serif is the QUIET counter-voice for prose, leads and quotations. One pair of fonts, opposite personality. This inversion is the system's core identity; flattening it back to serif-led headings destroys the theme.

### Hierarchy
- **Display** (800, 5.30rem cover / 6.10rem section / 5.60rem statement, line-height ≤0.98, tracking −0.028 to −0.03em): cover titles, section-divider titles, statement claims, oversized metrics (9.50rem `--fs-mega`).
- **Headline** (800, 3.50rem, line-height 0.98): the standard slide title (`h2.slide-title`), max-width 22ch, carrying the green marker bar.
- **Title** (700, 2.20rem, tracking −0.014em): sub-headings (`h3`), column heads.
- **Lead** (serif 500, 2.00rem, line-height 1.26): the serif lead paragraph, max-width 30ch.
- **Body** (serif 500, 1.52rem, line-height 1.46): prose, max-width 62ch — set a touch big because EB Garamond's small x-height reads small in a hall.
- **Label** (700, 1.05rem `--fs-label`, letter-spacing 0.10em `--track-hall`, UPPERCASE): every label *inside* the canvas that carries meaning — kickers, callout labels, stat labels, column heads, chart heads, bar-axis ticks, table headers, chips, figure numbers, step numbers.
- **Chrome** (700, 0.80rem `--fs-footer`, letter-spacing 0.18em, UPPERCASE): the deck footer and running head, which sit outside the scaled canvas, plus the browser-frame simulations and QR URLs that are representational rather than read.

**The Hall Label Rule.** The label voice splits in two, and the split is by *distance*, not by component. A label printed on paper is read at 40cm; a label projected in a lecture hall is read at 20m, and the hall is the primary reader. If a label tells the audience what a figure counts, which decade a bar sits in, or what a column holds, it takes `--fs-label` — never the chrome size. The tracking eases from 0.18em to 0.10em as the cap grows, and a larger label takes *less* space beneath it, so the net slide height barely moves. Test: cover the numerals and read only the labels from the back of the room.

### Named Rules
**The Inverted Hierarchy Rule.** Gothic leads, serif follows. Headings h1–h3 are always Libre Franklin at 700–800 with negative tracking; prose, leads, quotations and captions are always EB Garamond. Never swap the roles.

**The Serif h4 Rule.** `h4` deliberately stays in the serif register (EB Garamond 600, 2.00rem) — it reads as an emphatic lead, not a gothic label. Do not "fix" it to match h1–h3.

## Layout

The canvas is a **fixed 1280×720 reveal.js stage, uniformly scaled** by reveal's transform to fit the viewport. The type scale is therefore deliberately fixed rem — NOT viewport-fluid `clamp()`. Viewport units inside the canvas would fight the canvas transform; do not introduce them. Only chrome that lives outside the scaled canvas (deck footer, running head, TOC overlay) uses `clamp()` and media queries (`max-width: 640px` compacts chrome; `max-height: 560px` reserves a real footer strip outside the scaled area).

Each slide is a padded editorial column (padding 3.8rem top, 4.8rem sides, footer clearance below), content flowing from the top. **Hero layouts centre themselves; centring is not opt-in.** One rule at `.present` specificity gives `.cover`, `.section`, `.statement`, `.closing`, `.metric`, `.center` and `.balance` `display: flex !important` with `flex-direction: column; justify-content: center`. The `!important` and the `.present` qualifier are both load-bearing: reveal hard-sets `display: block` on the active slide, so a bare `justify-content` on the unqualified selector was inert, and for a period only `.balance` actually centred. `.balance` is now the opt-in for *non-hero* sparse slides only — on a hero it is redundant, not load-bearing. The same seven-selector list is restated as `html.reveal-print .reveal .slides .pdf-page > section.… { justify-content: center; }` in `01-foundations.css`, because reveal's print view re-parents each slide into a `.pdf-page` wrapper and the wrapper, not the section, is what carries `.present`. **The screen list and the print list must be edited together**; a hero class added to one and not the other centres on screen and top-aligns on paper. Multi-column content uses `.cols` (equal or 3:2 / 2:3 / 1:2 ratios, 4rem gutters). Spacing follows a 4pt-derived semantic scale (0.25rem–4rem). Prose measures are enforced: 62ch body, 56ch lists, 30ch leads, 22ch slide titles.

**The closing is the one documented exception to those measures.** The hero measures were drawn for slides that carry a figure beside the type; the closing carries nothing but type, so at 16ch/30ch it stacked a narrow column down the left third and left the rest of the navy field empty — which is why three decks had waived the fit check with identical `data-fit-allow="deliberate full-bleed closing composition"` boilerplate instead of fixing the composition. `.closing h2` now runs to 22ch and `.closing .lead` to 46ch, overriding the global 30ch lead. The three waivers are deleted and those closings render at scale 1.0 (Luxembourg's at 0.960). Widen a measure only where the composition is all type and the fit check proves the result; do not generalize 46ch back onto `.lead`.

Content flows from the top and the bottom is allowed to run ragged. That is the contract, not a defect: a slide title in a constant position across a deck is worth more than a vertically balanced one, and `.balance` is the opt-in for genuinely sparse *non-hero* slides. Measured on the published decks, slides carrying more than 120px of slack run 1/17, 0/17, 4/22 and 0/18. (A far larger figure reported earlier measured `talks/_showcase/`, whose slides carry deliberately minimal placeholder copy to demonstrate layouts; it is not evidence about real decks.)

**The Floating Control Clearance Rule.** A control that floats over a panel insets the panel's own text by the control's box plus a gap, and the rule beneath that text still spans the full width. `.toc-head` carries `padding-right: calc(2.4rem + var(--space-sm))` for exactly this: the 2.4rem `.toc-close` button overlapped the head's box at every viewport tested (1280×720, 844×390, 390×844, 1920×1080), and only the word "Contents" being short kept the collision off the screen. Clearance is now 20–34px. Padding insets the text, never the border.

**The Chrome Is Not Prose Rule.** The TOC overlay is mounted inside `.reveal`, so every rule written for slide prose reaches it. Three did: `.reveal ul` capped the contents list at the 56ch body measure, `.reveal ul > li` indented each row 1.5em and spaced it 0.5em, and `.reveal ul > li::before` gave every row the green bullet tick. The rows therefore sat indented from the head's rule on the left, stopped well short of it on the right, and each carried a stray tick sized for 1.52rem serif. `.toc-list` opts out of all of it — and the opt-out must be written as `.reveal .toc-list`, because a bare `.toc-list` (0,1,0) loses to `.reveal ul` (0,1,1); the reset that lived there before never applied at all. Any furniture placed inside `.reveal` states its own list, measure and marker, at `.reveal`-qualified specificity.

**The Border-Box Chrome Rule.** `box-sizing: border-box` is set on the slide canvas, not globally, so anything mounted outside `.slides` gets the browser default. `.toc-panel` declared `width: min(92vw, 60rem)` and was sizing its *content* box, adding 2×2rem of padding on top: a 423px panel on a 390px phone, running past the screen with the close button 14px beyond its right edge, and 1062px on desktop where 60rem (960px) was the stated intent. Chrome that declares a width against the viewport sets `box-sizing: border-box` in the same rule.

**The Fixed Canvas Rule.** All sizing inside `.reveal .slides` is rem on a 16px root, scaled as a whole. Never use vw/vh/clamp() for slide content; reserve responsive units for the unscaled chrome (footer, runhead, TOC overlay) only. This binds *caps* as much as type: the tallest a figure or code block may stand is `{spacing.block-max}` (`--block-max-h`), which replaced two `62vh` literals — the `.figrow` figure image and the `pre code` block. A vh cap measures the *window*, not the scaled 1280×720 stage, so the same slide held a different amount of image on a laptop, a hall projector and a phone; 28rem is that 62vh taken once at the 720px reference height and then frozen. Three viewport heights survive on purpose, and all three are true overlays that live outside the scaled canvas: the TOC panel (`max-height: 90vh`) and the lightbox figure and image (`88vh` / `80vh`). If a new vh appears anywhere else inside `.reveal .slides`, it is a bug.

## Elevation & Depth

Flat by default. Depth is conveyed by the ruled hierarchy (heavy near-black rules vs. hairlines), tonal neutrals (Paper → Panel → Sunken), and full-bleed colour fields — never by lifting content on shadows. The theme's own token comment is normative: shadows are "tight, neutral; used only for true overlays (lightbox, QR)".

### Shadow Vocabulary
- **shadow-1** (`box-shadow: 0 1px 2px oklch(0.2 0.02 258 / 0.07), 0 2px 6px oklch(0.2 0.02 258 / 0.05)`): the smallest overlay affordance; rarely used.
- **shadow-2** (`box-shadow: 0 4px 14px oklch(0.2 0.02 258 / 0.10), 0 14px 40px oklch(0.2 0.02 258 / 0.12)`): the browser-chrome screenshot frame (`.chrome`), which floats as a captured artifact.
- **shadow-pop** (`box-shadow: 0 22px 60px oklch(0.16 0.03 258 / 0.30)`): true modal overlays — the TOC panel, lightbox, QR pop.

### Named Rules
**The Overlay-Only Shadow Rule.** Slide content is flat. A shadow may appear only on an element that genuinely floats above the deck (TOC panel, lightbox, QR pop, the browser-chrome frame). Never on callouts, stats, panels, columns or any in-flow content.

## Shapes

Sharp by default — the broadsheet leans on rules, not cards. Radii are minimal and utilitarian: 3px (`sm`) for chips and plate images, 5px (`md`) for the TOC panel and sunken panels, 8px (`lg`) only for the browser-chrome frame. Hairlines (1px `line`) divide; heavy rules (2–4px near-black `rule`, or the 4px green `--bar`) structure. Bars and ticks take a 1px radius so they read as printed rules, not pills. Images are sharp-cornered plates with a 1px `line-strong` border; full-bleed media has no border or radius at all.

**The Ruled, Not Boxed Rule.** Structure is drawn with confident rules and hairlines — a heavy top rule opens a callout, hairlines divide a ledger, a left bar marks the active choice. Components almost never take a filled box, shadow, or card shape. If a grouping needs a surface, the only sanctioned one is the flat `Sunken` inset (`.panel.sunken`) — no border, no shadow.

Two surfaces were brought back under this rule in the last pass, and both are its reference reading. **The process flow (`.flow-step`)** carried a 1px `Line` border and a `--radius-md` corner: three bordered radiused boxes joined by arrows, on the slide captioned "A process, drawn — not bulleted" — the one composition on the deck an unrelated product could have shipped unchanged. Each step now opens on `border-top: var(--bar) solid var(--rule)`, the same heavy near-black rule `.panel` opens on, and separation comes from the gutter (`--space-xl` between steps, up from `--space-xs`) rather than from a border. **The code block (`.reveal pre`)** likewise dropped its hairline (`border: none`); with the `Sunken` fill and `--radius-md` unchanged it now matches `.panel.sunken` exactly — the one sanctioned surface, which carries no border. A block that wants a boundary takes the opening rule or the Sunken fill, never a hairline outline on top of either.

**The Rule Opens From Above Rule.** A heavy rule that opens a block must have visible air above it, or it stops reading as an opening. `.marginnote` therefore takes `margin-top: var(--space-lg)` (reset to 0 when it is the first child): set flush under a chart, its 3px rule read as one more unlabelled near-black bar in the series rather than as the start of an aside.

**The Rules Line Up Or Clearly Don't Rule.** Two instances of the same device sitting adjacent either end at the same x or differ obviously; a near-miss reads as a mistake where a clear difference would have read as a decision. `.stat-grid + .callout` therefore takes the ledger's own column (`max-width: calc((100% - var(--space-3xl)) / 2)`) in place of the callout's 60ch prose measure — at 60ch the note's rule stopped 32px past the stat column above it. Scoped to that one adjacency: a standalone callout keeps its 60ch.

## Components

### Slide Title (the signature device)
- **Character:** the gothic headline with the heavy green marker bar drawn above it.
- **Type:** Libre Franklin 800, 3.50rem, line-height 0.98, tracking −0.022em, `Ink Bold`, max-width 22ch.
- **Marker:** a 2.6rem × 4px (`--bar`) `Lead Green` bar at top-left, 1px radius, with `padding-top: calc(4px + 1rem)` clearance. It draws in from the left (`rule-draw`, 560ms) on slide entry.
- **Opt-out:** `.no-rule` drops the bar and its padding.

### Kicker
- **Style:** gothic overline label — Libre Franklin 700, 1.05rem (`--fs-label`), uppercase, letter-spacing 0.10em (`--track-hall`), `Ink Soft` — preceded by a 1.4em × 3px green tick, and set tight to the title it introduces (`--space-xs` beneath).
- **Variants:** `.warm` (brown-deep text, brown tick), `.navy`, `.green`; on dark fields the kicker lifts to `Gold Spark`/gold-bright.

### Callout
- **Style:** a ruled editorial aside, not a box: 3px near-black top rule, no background, no border elsewhere. Gothic uppercase `.callout-label` (0.80rem, 0.18em tracking, `Ink Bold`), serif body at 1.18rem, max-width 60ch.
- **Variants:** `.warm` / `.navy` / `.green` tint the rule and label only.

### Stat / Stat Ledger
- **Stat:** big gothic numeral (Libre Franklin 800, 3.50rem, line-height 0.92, tabular lining figures, `Ink Bold`) over a gothic uppercase label (0.80rem, 0.12em, `Ink Soft`).
- **Ledger (`.stat-grid`):** two columns; each row is label left, green-deep figure right (2.20rem), baseline-aligned on a hairline, with a 3px near-black top rule opening each column. Reads like a colophon, not a card grid. Figures count up on entry via `data-count`. A `.callout` placed directly after the ledger drops to the ledger's column width so the two 3px rules end at the same x (see The Rules Line Up Or Clearly Don't Rule).

### Index List (contents / agenda)
- **Style:** a ruled grid: 3px near-black rule top and bottom, 1px hairlines between rows. Each row = big gothic folio (`decimal-leading-zero`, 800, 1.9rem, `Lead Green` deep) + gothic title (700, 2.20rem, `Ink Bold`) + optional serif description (1.18rem, `Ink Soft`).

### Chip
- **Outline (default):** transparent, 1.5px `Line Strong` border, 3px radius, gothic uppercase 0.80rem/700/0.08em, `Ink Soft`; padding 0.22em 0.6em.
- **Variants:** `.green` (green border, green-deep text), `.navy`, `.warm`, `.solid` (Lead Green fill, Paper text).

### Section Divider
- **Style:** a full-bleed saturated `Lead Green` field (`--green-field`, green deepened 14% toward near-black) with a 4px plate rule across the top drawn in the field's own mark (`--ond-mark`), an oversized outlined folio, and a giant gothic title (800, 6.10rem, Paper, line-height 0.94) with an italic serif subtitle in `--ond-quiet`. The per-variant `.section.navy::before` and `.section.warm::before` plate overrides were deleted: the register already hands each field the right mark.
- **Folio (`.sec-no`):** 9.50rem gothic, outlined rather than ghosted. Inside `@supports (-webkit-text-stroke: 3px currentColor)` it becomes `color: transparent` with a 3px Paper stroke, so it carries the field's full Paper contrast (4.97:1 on green, 13.06:1 on navy) at almost none of its visual mass and still sits under the title. As a 24% ghost it measured 1.52:1; that fill remains only as the no-support fallback. Verified through the `?print-pdf` export path.
- **Variants:** `.navy` (navy field, gold-bright rule) for the structural deep; `.warm` (brown field) for the critical stakes strand, sparingly.

### Statement
- **Default:** a huge gothic claim — Libre Franklin 800, 5.60rem, line-height 0.98, tracking −0.03em, `Ink Bold`, max-width 18ch, with one `.accent` phrase in green-deep.
- **Quote variant:** the human voice returns to the serif italic (500, 5.60rem, line-height 1.08) opened by a `Gold Spark` quotation mark.

### Closing (the colophon)
- **Character:** the sign-off page — a full-bleed `--navy-field` deep-pole slide with a 4px `--ond-mark` plate rule at the head, read as a masthead colophon rather than as another content slide.
- **Measures:** title at display size (`--fs-h1`, 800, line-height 0.96, tracking −0.028em, Paper) to **22ch**; serif lead in `--ond-quiet` to **46ch**. These override the global hero/lead measures on purpose; see Layout.
- **Byline (`.byline.authors`):** on the closing only, the author blocks read **across** — `flex-direction: row; flex-wrap: wrap; align-items: stretch; gap: var(--space-xl)`, each `.author` at `flex: 0 1 auto; max-width: 34ch`. Institution marks are pushed to the foot of their block (`margin-top: auto; padding-top: var(--space-sm)`) so they sit on one line no matter how many lines each author runs; without that they land at different heights and the row reads as two stacked cards. Monochrome logos invert to white at 85% opacity; `.keep-color` opts a box logo out.
- **Elsewhere the byline stays a column.** Under a cover title the byline is a caption and stacking is correct; the generic `.byline` / `.byline.authors` outside `.closing` is unchanged.
- **Colour:** links, kicker, contact icons and dropcap take `--ond-mark` (gold-bright); names `--ond-text`, affiliations and roles `--ond-quiet`.

### Deck Nav Button (footer chrome)
- **Landmarks:** the footer is a real `role="contentinfo"` element and its controls sit inside a genuine `<nav class="deck-nav">` carrying an `aria-label` — chrome that steers the deck is a navigation landmark, not a div of buttons.
- **Shape:** 2rem square, 3px radius, 1.5px `Line Strong` border, transparent fill, `Ink Soft` icon.
- **Hover:** fills `Lead Green`, text to Paper, `translateY(-1px)`; **Focus:** 2px `--focus-ring` outline, 2px offset; **Disabled:** 30% opacity. On dark fields it takes a 10%-Paper fill, an `--ond-rule` border and an `--ond-text` glyph, and hovers to the field's mark (`--ond-mark` fill, `--ond-mark-ink` glyph).

### Print Imprint (`.pdf-imprint`)
- **Character:** the folio for paper. One persistent footer is right on screen because it updates as you move; on paper every page is final and needs its own mark. The live `.deck-footer` and `.deck-runhead` are therefore hidden outright under `html.reveal-print`, and `buildPrintImprints()` (`shared/src/deck/02-chrome.js`, called from the `PRINT` branch of `08-diagnostics.js` on `pdf-ready`) appends one imprint per `.pdf-page`, numbered from that page's own index. The behaviour it replaces parked the single live footer at the tail of the last page carrying whatever folio was current when the export ran — one wrong number and sixteen blank ones.
- **Voice:** the screen footer's, restated — chrome caps (Libre Franklin 700, 0.80rem `--fs-footer`, 0.18em tracking, uppercase, line-height 1.2), a 2px `Rule` above with 0.5rem clearance (the same weight and colour as `.deck-footer::before`, so the two read as one device), deck title (and venue) left with ellipsis, folio right. Absolutely positioned at the slide's own `--slide-pad-x` inset, `--space-md` from the page foot, so it lands on the same measure as the column above it.
- **On paper:** title in `Ink Faint` (5.15:1 on Paper), folio in `--green-deep` (6.12:1), the `/` separator dropped back to `Ink Faint` at weight 400, tabular lining figures. The rule is the heavy near-black `Rule` at 18.71:1.
- **On dark pages:** the register is read from the shared `fieldOf()` helper, never from a second class list, and every colour comes through the on-dark tokens — `--ond-chrome` for the title, `--ond-mark` for the folio, `--ond-rule` for the rule. The imprint is appended to `.pdf-page`, a *sibling* of the section, so it inherits nothing from the field: like `.deck-footer`, it has to be **named in the deep-register override list** in `01-foundations.css` to reach the deep ramp. On the bright fields it spends Paper alone — 4.97:1 on the green divider, 5.71:1 on the brown. On the deep pole it opens the ramp and takes the spark: title 6.22:1, gold folio 7.13:1, rule 3.71:1 on navy, so the folio answers the gold plate rule at the head of the same page.
- **Print fidelity:** carries `print-color-adjust: exact`, like the divider fields and the media scrim, so the folio colour survives the export rather than being helpfully flattened.
- **Escaping:** the deck title and venue are passed through `escapeHTML()` (`01-foundation.js`) here and in the live footer, because the engine builds all chrome by string concatenation. Any new chrome built the same way does the same.

### Media Field (full-bleed image)
- **Character:** the one dark ground the theme does not own — the image underneath it can be anything — so the scrim is built as a guarantee rather than a gesture.
- **Scrim (`.media-scrim`):** two crossed gradients, one up from the caption edge and one in from the reading edge, darkest stop held above 0.85 alpha over `oklch(0.14 0.02 258)`.
- **Footer band (`section.media::after`):** a theme-owned strip the height of the footer clearance, present whether or not the author added a scrim, because the footer is chrome the author never sees when choosing the image.
- **Measured worst case** (a pure-white frame): Paper reads 18.8:1 on the footer strip and 13.2:1 in the caption zone — deeper than the navy field, which is why `.media` sits in the deep register and its caption kicker takes gold. Both layers carry `print-color-adjust: exact` so the guarantee survives PDF export.

### Process Flow (`.flow`)
- **Character:** a process drawn as ruled columns, not as boxes joined by arrows.
- **Structure:** a flex row of `.flow-step` columns (`flex: 1 1 0`) with an `--space-xl` gutter; each step opens on a 4px (`--bar`) near-black `Rule` top border with `padding: var(--space-sm) 0 0` — no background, no side or bottom border, no radius.
- **Contents:** gothic uppercase step number (`.step-n`, 600, `--fs-label`, 0.12em tracking, `Structural Navy`), gothic step head (`.step-h`, 600, body size, line-height 1.08), serif gloss at caption size in `Ink Soft`, and an optional italic `.step-q`.
- **Vector chip (`.step-vec`):** monospace at caption size on the `Sunken` fill with a 3px (`--radius-sm`) corner and no border — the same treatment as inline `code`.
- **Arrow (`.flow-arrow`):** sits *on* the rule band rather than beside the prose — `align-self: flex-start`, `height: var(--bar)`, a half-bar negative top margin, `--green-deep`, `--fs-small`, weight 700. `.flow.tight` closes the gutter to 0.

### Table (ruled ledger)
- **Style:** no boxes and no vertical lines — a gothic uppercase header row (700, 0.82em, 0.10em tracking, `Ink Bold`) over a 3px near-black `Rule`, 1px hairlines between body rows, and `Sunken` at 70% transparency striping the even rows. Body text at `--fs-small`; `.num` columns are right-aligned with tabular lining figures.
- **Padding:** `0.55em calc(0.9 * var(--fs-small))`. The horizontal value is measured against the *table's* font-size, not the cell's; the vertical value stays in em on purpose, so a smaller header row keeps a proportional band.

### Inline Highlight (`mark` / `.hl`)
- **Style:** a gold wash laid as a gradient from 58% height, so it reads as a highlighter stroke under the phrase rather than as a filled chip; square corners (`border-radius: 0`), text colour inherited.
- **Overhang:** `padding: 0 0.2em; margin: 0 -0.14em`. The stroke overshoots the first and last glyph the way a real marker does, and the negative margin gives the space back so surrounding text does not move. At the former 0.06em (1.4px) the wash stopped flush against the glyphs and read as a printing error.

### Progress Bar
- **Style:** a 3px rule on the viewport, `Lead Green` fill on light over an ink track at 22% opacity.
- **On dark:** the fill takes `--ond-mark` — a green bar on a green divider was drawing itself at 1.28:1 against its own background, invisible on exactly the slides that end a section — and the unfilled track lifts from 1.23:1 to 1.61:1.

### Plate (documentary figure)
- **Style:** the one image treatment, never broken: documentary photographs get a green duotone (SVG filter `#duo-green`, navy variant available) on an ink ground (`#04140d`), a 1px `Line Strong` border, and a ruled caption — 2px near-black top rule, gothic uppercase "Fig." mark in green-deep, italic serif gloss. Live UI screenshots instead keep true colour inside real browser chrome (`.chrome`, 8px radius, shadow-2). In `.figrow` splits, documentary figures show whole (`object-fit: contain`); `.crop` bleeds true photos.

### Named Rules
**The Ink-on-Paper Motion Rule.** One motion idea, repeated and restrained (`--draw: 560ms`, ease-out-quint): rules draw in from the left, chart bars grow from the baseline, figures count up (`data-count`) on slide entry. Everything stills under print, `prefers-reduced-motion`, and hidden tabs; `.no-draw` opts a deck or slide out.

**The Two Image Treatments Rule.** Every image is either a duotone plate with a ruled caption, or a true-colour screenshot in browser chrome. No naked JPEGs.

**The Themed Focus Rule.** Focus is never the browser default. One token carries it — `--focus-ring`, `--green` on light (3.87:1 on Paper) and Paper on every dark field (green measures 1.28:1 on its own field, 1.47:1 on brown). `.deck-btn`, `.toc-item`, `.is-zoomable` and in-slide links all consume it, and focus radii take `var(--radius-sm)`.

**The Focus Ring Is Not Animated Rule.** A focus indicator appears the instant focus lands; it never fades up. Every transition in the theme names its properties — `.deck-btn`, `.toc-close` and the lightbox close button list `background-color, border-color, color, transform`; `.fragment.fade-up` lists `transform, opacity`. `transition: all` appears nowhere in the theme: it swept `outline-color` and `outline-offset` into the 220ms (`--dur`) ramp, so the ring arrived late on exactly the interaction that needs it immediately. Add a property to a transition by naming it.

**The Padding Measures The Container Rule.** Em padding resolves against the element's own font-size, so a header cell at 0.82em and a body cell at 1em drew different gutters from one declaration — 12.4px against 17.0px — and a right-aligned header sat 4.6px inboard of the numerals it labelled. Horizontal cell padding is therefore `calc(0.9 * var(--fs-small))`: one gutter measured against the table, so header ink and numeral ink end at the same x (1186.2px, measured). A prior reading blamed trailing letter-space on the tracked headers; measurement showed the em mismatch was the cause. Any grid whose columns must align across rows of different type sizes sizes its gutter against the container, not the cell.

**The Scrim Guarantee Rule.** A dark ground the theme does not own must be manufactured, not assumed. Full-bleed media carries a theme-owned footer band regardless of what the author added, and any new overlay-on-image pattern states the contrast it holds against a worst-case white frame.

## Do's and Don'ts

### Do:
- **Do** put the 4px green marker bar above every standard slide title; use `.no-rule` only when a layout genuinely replaces it (cover, section, statement).
- **Do** spend colour as fields: full-bleed green/navy divider planes, heavy rules, solid fills. Green leads, navy is the deep pole, gold is the single spark on dark.
- **Do** use the AA-derived depths for text: `--green-deep` for green text/links on light, `--brown-deep` for brown, `--gold-bright` for gold on dark. WCAG 2.2 AA is binding.
- **Do** keep the inverted hierarchy: Libre Franklin 700–800 with negative tracking for display, EB Garamond for all prose, leads and quotations — and leave `h4` in the serif.
- **Do** size in fixed rem inside the 1280×720 canvas and let reveal's transform scale it; keep clamp()/media queries for the unscaled chrome only.
- **Do** structure with rules: 3px near-black top rules to open, 1px hairlines to divide, tabular lining figures in ledgers — hairlines at 2.22:1 and control borders at 3.52:1, sized for the hall rather than the page.
- **Do** colour dark fields through the on-dark tokens (`--ond-text`, `--ond-quiet`, `--ond-chrome`, `--ond-mark`, `--ond-rule`, `--ond-mark-ink`) instead of naming Paper or gold directly; the deep pole and the bright fields then each get the value that measures.
- **Do** centre heroes by giving the slide one of the seven centring classes and nothing else; if you add a new hero class, add it to *both* the `.present` list in `03-layouts.css` and the `.pdf-page` list in `01-foundations.css`.
- **Do** cap a figure or code block with `--block-max-h` (28rem), and give print its own per-page `.pdf-imprint` rather than expecting the live footer to travel.
- **Do** ask `fieldOf()` which register a surface sits in — it is the one answer the live chrome and the printed imprint share.
- **Do** let the closing take its own measures (22ch title, 46ch lead, byline in a row) — it is all type, and it is the only place those overrides apply.
- **Do** give an opening rule air above it and land adjacent rules at the same x; a near-miss between two copies of the same device reads as a mistake.
- **Do** inset a panel's own header text past any control floating over it (`calc(2.4rem + var(--space-sm))` on `.toc-head`) while leaving the rule full-width.
- **Do** open a process step, a panel or any grouped column on the 4px near-black rule and let the gutter separate them — `.flow-step` and `.panel` share one opening device.
- **Do** name every property a transition animates, and keep the focus ring out of them.
- **Do** measure a gutter that must align across type sizes against the container (`calc(0.9 * var(--fs-small))` on table cells) rather than against each cell's own em.
- **Do** theme every focus state with `--focus-ring` and a `var(--radius-sm)` corner — including in-slide links, which previously fell back to the browser default at about 1.5:1 on the navy closing field.

### Don't:
- **Don't** resurrect the retired tells: the 6-colour rainbow spectrum bar, the compass motif, tinted key-takeaway boxes, the per-slide green eyebrow + tick-rule, or drop-shadowed rounded cards.
- **Don't** put shadows on in-flow slide content — shadows exist only for true overlays (TOC panel, lightbox, QR pop) and the browser-chrome frame.
- **Don't** use viewport units or fluid clamp() type inside the slide canvas — including `vh` height caps, which measure the window rather than the 1280×720 stage. The only sanctioned viewport units are the three on true overlays (TOC panel, lightbox).
- **Don't** treat `.balance` as the way to centre a hero; the hero classes centre themselves, and `.balance` is for non-hero sparse slides.
- **Don't** interpolate a deck title, venue or any author string into chrome markup without `escapeHTML()`.
- **Don't** use gold as a second accent on light slides, set small text in raw `#009260`, or leave ink-coloured emphasis on a dark field (strong text lifts to Paper; the mark follows the register).
- **Don't** put gold — or amber, or sky — on a bright field: none of them clears 3:1 on the green divider. Separate tiers there by weight, and keep transparency on Paper under about 7%.
- **Don't** rely on a low-opacity fill to carry a large form; outline it instead, as `.sec-no` does with a 3px Paper stroke.
- **Don't** box what should be ruled: no cards, no filled panels with borders and radii — the only sanctioned surface is the flat Sunken inset.
- **Don't** waive the fit check with boilerplate when the real fault is a measure drawn for a different composition — fix the measure, as `.closing` now does.
- **Don't** widen `.lead` past 30ch outside `.closing`, or push the closing's row byline onto covers and other slides.
- **Don't** read the showcase deck's slack as a measurement of the system; its copy is placeholder by design.
- **Don't** write `transition: all` — it animates `outline-color` and `outline-offset` and makes the focus ring fade up over 220ms.
- **Don't** put a border on the Sunken inset (code blocks included) or a radius on a ruled column; the surface is either the fill or the opening rule, never either one plus a hairline outline.
- **Don't** convert the OKLCH neutrals to hex or "correct" the hex corporate palette; each format is normative where it stands.
