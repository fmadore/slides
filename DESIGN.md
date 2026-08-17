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
  line: "oklch(0.872 0.005 250)"
  line-strong: "oklch(0.700 0.010 256)"
  rule: "oklch(0.165 0.014 258)"
  ink: "oklch(0.205 0.016 258)"
  ink-bold: "oklch(0.150 0.016 262)"
  ink-soft: "oklch(0.405 0.018 258)"
  ink-faint: "oklch(0.560 0.016 256)"
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
    fontSize: "0.82rem"
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
---

# Design System: Broadsheet

## Overview

**Creative North Star: "The Scholarly Broadsheet"**

Broadsheet is the visual system of a reveal.js slide-deck engine for academic talks: a bold scholarly broadsheet, not a slide template. Its identity rests on the three rules the author wrote into the theme itself. First, an **inverted type hierarchy**: the newspaper gothic (Libre Franklin, pushed to its 700/800 weights with negative tracking) is the loud display voice, while the humanist book serif (EB Garamond) is the quiet counter-voice for body prose, leads and quotations — the reverse of a conventional academic deck. Second, **colour is a field, not a sprinkle**: the six binding Bayreuth corporate colours are spent as flat structural planes and heavy rules, never as a timid accent wash. Third, a **crisp, high-contrast page**: near-black ink on a cool near-white, with structure drawn by confident 3–6px rules rather than faint decoration.

The voice is authored-by-a-historian and must never read as template-made or AI-generated. The confirmed anti-references (retired tells): the 6-colour rainbow spectrum bar, the compass motif, tinted key-takeaway boxes, the per-slide green eyebrow + tick-rule, and drop-shadowed rounded cards. WCAG 2.2 AA is binding; hall-projection legibility leads every sizing decision (the serif body sits deliberately large because EB Garamond's small x-height reads small in a hall).

**Key Characteristics:**
- Inverted type hierarchy: loud gothic display, quiet serif prose
- Colour as full-bleed structural fields (green leads, navy is the deep pole, gold is the single spark)
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
- **Gold Spark** (`{colors.gold-spark}`): the single spark, used almost exclusively on dark fields — the plate rule atop `.section`/`.closing`, list ticks and kickers on dark, the quote mark, the inline `mark` highlight wash. Brightened (`--gold-bright`, `color-mix(... white 24%)`) for AA on dark.

### Tertiary
- **Amber Highlight** (`{colors.amber-highlight}`): minor supporting role; highlight washes.
- **Warm Brown** (`{colors.warm-brown}`): the warm "counter-thread" — `.section.warm` stakes divider, `.kicker.warm`/`.callout.warm` variants; darkened (`--brown-deep`) for AA small text on light.
- **Sky** (`{colors.sky}`): reserved corporate colour; smallest role, kept for palette fidelity.

### Neutral
- **Paper** (`{colors.paper}`): the page/slide background — cool, crisp near-white, not a warm-paper wash.
- **Panel** (`{colors.panel}`): faintly raised surfaces (TOC close button).
- **Sunken** (`{colors.sunken}`): insets, code blocks, table stripes, chart tracks.
- **Line** (`{colors.line}`): hairlines. **Line Strong** (`{colors.line-strong}`): stronger rules, plate borders, chip outlines.
- **Rule** (`{colors.rule}`): the heavy near-black editorial rule (3px dividers, callout tops, table header rules, footer/runhead rules).
- **Ink** (`{colors.ink}`): primary text. **Ink Bold** (`{colors.ink-bold}`): big display headlines. **Ink Soft** (`{colors.ink-soft}`): secondary text. **Ink Faint** (`{colors.ink-faint}`): tertiary text, captions, chrome.

### Named Rules
**The Field, Not Sprinkle Rule.** Colour arrives as a flat structural plane (a full-bleed divider field, a heavy marker bar, a solid fill) or not at all. Never as a timid tint, gradient wash, or decorative accent scattered across a light slide.

**The One Gold Spark Rule.** Gold appears on dark fields only — the plate rule, dark-field ticks and kickers, the quote mark. On paper it exists solely as the `mark` highlight wash. It is never a second accent competing with green on light slides.

**The Dark-Field Flip Rule.** On `.section`, `.closing` and `.media`, strong text lifts to Paper, list ticks and kickers lift to Gold Spark, and the footer chrome inverts (`.on-dark`). Never leave ink-coloured emphasis sitting on a dark field.

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
- **Label** (700, 0.82rem, letter-spacing 0.18em, UPPERCASE): kickers, callout labels, table headers, chips, chrome.

### Named Rules
**The Inverted Hierarchy Rule.** Gothic leads, serif follows. Headings h1–h3 are always Libre Franklin at 700–800 with negative tracking; prose, leads, quotations and captions are always EB Garamond. Never swap the roles.

**The Serif h4 Rule.** `h4` deliberately stays in the serif register (EB Garamond 600, 2.00rem) — it reads as an emphatic lead, not a gothic label. Do not "fix" it to match h1–h3.

## Layout

The canvas is a **fixed 1280×720 reveal.js stage, uniformly scaled** by reveal's transform to fit the viewport. The type scale is therefore deliberately fixed rem — NOT viewport-fluid `clamp()`. Viewport units inside the canvas would fight the canvas transform; do not introduce them. Only chrome that lives outside the scaled canvas (deck footer, running head, TOC overlay) uses `clamp()` and media queries (`max-width: 640px` compacts chrome; `max-height: 560px` reserves a real footer strip outside the scaled area).

Each slide is a padded editorial column (padding 3.8rem top, 4.8rem sides, footer clearance below), content flowing from the top; hero layouts (`.cover`, `.section`, `.statement`, `.closing`, `.metric`, `.balance`) centre vertically. Multi-column content uses `.cols` (equal or 3:2 / 2:3 / 1:2 ratios, 4rem gutters). Spacing follows a 4pt-derived semantic scale (0.25rem–4rem). Prose measures are enforced: 62ch body, 56ch lists, 30ch leads, 22ch slide titles.

**The Fixed Canvas Rule.** All sizing inside `.reveal .slides` is rem on a 16px root, scaled as a whole. Never use vw/vh/clamp() for slide content; reserve responsive units for the unscaled chrome (footer, runhead, TOC overlay) only.

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

## Components

### Slide Title (the signature device)
- **Character:** the gothic headline with the heavy green marker bar drawn above it.
- **Type:** Libre Franklin 800, 3.50rem, line-height 0.98, tracking −0.022em, `Ink Bold`, max-width 22ch.
- **Marker:** a 2.6rem × 4px (`--bar`) `Lead Green` bar at top-left, 1px radius, with `padding-top: calc(4px + 1rem)` clearance. It draws in from the left (`rule-draw`, 560ms) on slide entry.
- **Opt-out:** `.no-rule` drops the bar and its padding.

### Kicker
- **Style:** gothic overline label — Libre Franklin 700, 0.82rem, uppercase, letter-spacing 0.18em, `Ink Soft` — preceded by a 1.4em × 3px green tick.
- **Variants:** `.warm` (brown-deep text, brown tick), `.navy`, `.green`; on dark fields the kicker lifts to `Gold Spark`/gold-bright.

### Callout
- **Style:** a ruled editorial aside, not a box: 3px near-black top rule, no background, no border elsewhere. Gothic uppercase `.callout-label` (0.80rem, 0.18em tracking, `Ink Bold`), serif body at 1.18rem, max-width 60ch.
- **Variants:** `.warm` / `.navy` / `.green` tint the rule and label only.

### Stat / Stat Ledger
- **Stat:** big gothic numeral (Libre Franklin 800, 3.50rem, line-height 0.92, tabular lining figures, `Ink Bold`) over a gothic uppercase label (0.80rem, 0.12em, `Ink Soft`).
- **Ledger (`.stat-grid`):** two columns; each row is label left, green-deep figure right (2.20rem), baseline-aligned on a hairline, with a 3px near-black top rule opening each column. Reads like a colophon, not a card grid. Figures count up on entry via `data-count`.

### Index List (contents / agenda)
- **Style:** a ruled grid: 3px near-black rule top and bottom, 1px hairlines between rows. Each row = big gothic folio (`decimal-leading-zero`, 800, 1.9rem, `Lead Green` deep) + gothic title (700, 2.20rem, `Ink Bold`) + optional serif description (1.18rem, `Ink Soft`).

### Chip
- **Outline (default):** transparent, 1.5px `Line Strong` border, 3px radius, gothic uppercase 0.80rem/700/0.08em, `Ink Soft`; padding 0.22em 0.6em.
- **Variants:** `.green` (green border, green-deep text), `.navy`, `.warm`, `.solid` (Lead Green fill, Paper text).

### Section Divider
- **Style:** a full-bleed saturated `Lead Green` field (`--green-field`, green deepened 14% toward near-black) with a 4px `Gold Spark` plate rule across the top, an oversized ghosted folio (9.50rem, Paper at 24% opacity), and a giant gothic title (800, 6.10rem, Paper, line-height 0.94) with an italic serif subtitle at 78% Paper.
- **Variants:** `.navy` (navy field, gold-bright rule) for the structural deep; `.warm` (brown field) for the critical stakes strand, sparingly.

### Statement
- **Default:** a huge gothic claim — Libre Franklin 800, 5.60rem, line-height 0.98, tracking −0.03em, `Ink Bold`, max-width 18ch, with one `.accent` phrase in green-deep.
- **Quote variant:** the human voice returns to the serif italic (500, 5.60rem, line-height 1.08) opened by a `Gold Spark` quotation mark.

### Deck Nav Button (footer chrome)
- **Shape:** 2rem square, 3px radius, 1.5px `Line Strong` border, transparent fill, `Ink Soft` icon.
- **Hover:** fills `Lead Green`, text to Paper, `translateY(-1px)`; **Focus:** 2px green outline, 2px offset; **Disabled:** 30% opacity. On dark fields the button takes a translucent Paper treatment and hovers to Gold on navy-deep.

### Plate (documentary figure)
- **Style:** the one image treatment, never broken: documentary photographs get a green duotone (SVG filter `#duo-green`, navy variant available) on an ink ground (`#04140d`), a 1px `Line Strong` border, and a ruled caption — 2px near-black top rule, gothic uppercase "Fig." mark in green-deep, italic serif gloss. Live UI screenshots instead keep true colour inside real browser chrome (`.chrome`, 8px radius, shadow-2). In `.figrow` splits, documentary figures show whole (`object-fit: contain`); `.crop` bleeds true photos.

### Named Rules
**The Ink-on-Paper Motion Rule.** One motion idea, repeated and restrained (`--draw: 560ms`, ease-out-quint): rules draw in from the left, chart bars grow from the baseline, figures count up (`data-count`) on slide entry. Everything stills under print, `prefers-reduced-motion`, and hidden tabs; `.no-draw` opts a deck or slide out.

**The Two Image Treatments Rule.** Every image is either a duotone plate with a ruled caption, or a true-colour screenshot in browser chrome. No naked JPEGs.

## Do's and Don'ts

### Do:
- **Do** put the 4px green marker bar above every standard slide title; use `.no-rule` only when a layout genuinely replaces it (cover, section, statement).
- **Do** spend colour as fields: full-bleed green/navy divider planes, heavy rules, solid fills. Green leads, navy is the deep pole, gold is the single spark on dark.
- **Do** use the AA-derived depths for text: `--green-deep` for green text/links on light, `--brown-deep` for brown, `--gold-bright` for gold on dark. WCAG 2.2 AA is binding.
- **Do** keep the inverted hierarchy: Libre Franklin 700–800 with negative tracking for display, EB Garamond for all prose, leads and quotations — and leave `h4` in the serif.
- **Do** size in fixed rem inside the 1280×720 canvas and let reveal's transform scale it; keep clamp()/media queries for the unscaled chrome only.
- **Do** structure with rules: 3px near-black top rules to open, 1px hairlines to divide, tabular lining figures in ledgers.

### Don't:
- **Don't** resurrect the retired tells: the 6-colour rainbow spectrum bar, the compass motif, tinted key-takeaway boxes, the per-slide green eyebrow + tick-rule, or drop-shadowed rounded cards.
- **Don't** put shadows on in-flow slide content — shadows exist only for true overlays (TOC panel, lightbox, QR pop) and the browser-chrome frame.
- **Don't** use viewport units or fluid clamp() type inside the slide canvas; it fights the uniform canvas transform.
- **Don't** use gold as a second accent on light slides, set small text in raw `#009260`, or leave ink-coloured emphasis on a dark field (strong text lifts to Paper, ticks to gold).
- **Don't** box what should be ruled: no cards, no filled panels with borders and radii — the only sanctioned surface is the flat Sunken inset.
- **Don't** convert the OKLCH neutrals to hex or "correct" the hex corporate palette; each format is normative where it stands.
