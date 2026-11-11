# Design history

The archaeology behind [`DESIGN.md`](../DESIGN.md): how each rule was found, what the system measured before a fix, and the values that have since been superseded. DESIGN.md states the rules; this file records why they exist. It is not required reading for authoring a deck. Headings follow DESIGN.md's.

## Overview

Broadsheet replaced an earlier "editorial archive" look. The retired tells listed in DESIGN.md (the 6-colour rainbow spectrum bar, the compass motif, tinted key-takeaway boxes, the per-slide green eyebrow with a tick rule, drop-shadowed rounded cards) were each present in an earlier pass and removed because they read as template-made.

### The de-template pass (November 2026)

The owner judged that the theme still "looked very Claude-made". The pass removed the tics without changing the system:

| Before | After |
|---|---|
| Kicker opened on a 1.4em × 3px green tick, on light and dark fields | No tick; the green marker above the title is the slide's one mark |
| Running head shown on every content slide, over a full-width 2px rule | Hidden on any slide carrying a `.kicker` or `.dateline`; the rule is gone (the footer keeps its rule) |
| 22 rules set `text-transform: uppercase` | 7, all chrome |
| `--fs-label` 1.05rem, tracked caps at `--track-hall` (0.10em) | 1.15rem, sentence case at `--track-case` (0.005em); lowercase reads smaller than a cap at the same size, so the label grew when it dropped the caps |
| Display weight 800 on h1–h3, section, statement, closing and cover titles | 700 (stat and metric numerals keep 800) |
| `--track-tight` −0.022em; display −0.028/−0.03em | −0.012em; display −0.018em |
| Cover h1 measure 17ch | 18ch |
| Ordered lists and `.index-list` numbered `01, 02, 03` (`decimal-leading-zero`); index numeral at 800 | `1, 2, 3`; index numeral at 700. The footer counter keeps `01 / 17` |
| `.sec-no`: a 9.50rem outlined folio (3px Paper `-webkit-text-stroke` under `@supports`, a 24% Paper ghost as fallback, which measured 1.52:1) | A quiet optional label (label font 700, `--fs-h3`, `--ond-quiet`); the `@supports` block is deleted and the showcase and template dividers no longer use it |
| A run of callouts each opened on the 3px rule | Only the first does; the rest take a hairline |
| `.org-logo` 1.7rem on cover and closing (the university's name inside the mark was 4px tall) | 2.5rem, still after the byline |
| Footer cluster mark 1.15rem | 1.4rem |
| Table headers 0.82em tracked caps; stat, chip, step and figure labels at 0.08–0.12em caps; chart heads in Ink Faint | All in the sentence-case label voice; chart heads in Ink Soft |
| Dateline, versal, ghosted folio and colophon presented as the "editorial signature", colophon on the showcase closing | Kept in CSS, demoted to "use sparingly", shown only on an uncounted annexe slide of the showcase |
| Showcase and template copy carried em-dash titles and slogan kickers; the template seeded a kicker | De-sloganed; the template seeds none |

### Live frames (November 2026)

Until this pass a live `.site-frame` iframe with no readiness handshake was covered by an engine fallback ("This website uses a network connection.") with an explicit **Show the site here** button, and the legacy `data-frame-trusted` attribute had been demoted so that it no longer dismissed a fallback on its own. The owner's stated preference was the reverse: show the site directly, live where possible. The opt-in button, its `.frame-show` style and the `frameNetwork` / `frameShow` strings were removed and `frameLoading` added. A no-cors reachability request now decides whether the engine's notice stays, and `data-frame-trusted` once again lets an authored saved view give way, but only when the site is also reachable.

## Colors

- **Line** was a 1.43:1 printer's hairline: present at 40cm, gone on a weak beamer, which quietly turned "Ruled, not boxed" into floating text. It was re-spaced to 2.22:1, and **Line Strong** (3.52:1) was split off for control and plate borders to clear WCAG's 3:1 for a component boundary.
- The Two Dark Registers Rule superseded a single Dark-Field Flip Rule that painted every dark field the same way, which left gold (2.17:1) and transparent Paper tiers under threshold on the green divider.
- The per-variant `.section.navy::before` and `.section.warm::before` plate overrides were deleted once the register handed each field its own mark.
- Six derived colours are mixed inline in their one rule rather than promoted to `:root`, because a single-user token invites a second, unmeasured user.

## Typography

- **The third face.** Before JetBrains Mono was vendored, the same 55-character line at 19px ran 574.5px in a bare machine's generic monospace, 612.3px on the author's laptop (Cascadia Code; `ui-monospace` did not resolve in Chrome there) and 627px in the face the theme named. The published PDFs, made in CI, were set in the first. The italic subset matters because highlight.js sets comments in it; without it every comment was a synthesised oblique.
- **The Hall Label Rule** first moved in-canvas labels from the chrome size (0.80rem, 0.18em) to `--fs-label` 1.05rem at 0.10em, with less space beneath so slide height barely moved. The November 2026 pass then dropped the caps (see above).

## Layout

- **Hero centring.** Reveal hard-sets `display: block` on the active slide, so a bare `justify-content` on the hero selectors was inert, and for a period only `.balance` actually centred. The rule now lives at `.present` with `!important`, restated for `.pdf-page` and for the scroll view.
- **Scroll view column.** Before the restatement the 1280px canvas became a 1376px content box in `?view=scroll`, clipped 48px at each edge, with the copy flush into the top-left corner. Forcing flex on every slide instead put the deck into a fixed-height column: twelve Erlangen slides came out exactly 595px tall and the two the fit engine scaled (×0.979, ×0.903) stopped registering as overflowing. The faithful restatement gives the same scales as the screen to three decimals.
- **The closing measures.** At 16ch/30ch the closing stacked a narrow column in the left third, and three decks had waived the fit check with identical `data-fit-allow="deliberate full-bleed closing composition"` boilerplate. The 22ch/46ch measures removed the waivers; those closings render at 1.0 (Luxembourg's at 0.960).
- **Ragged bottoms.** Slides with more than 120px of slack measured 1/17, 0/17, 4/22 and 0/18 on the published decks. A larger figure reported earlier came from the showcase, whose placeholder copy is minimal by design.
- **Floating Control Clearance.** The 2.4rem `.toc-close` overlapped `.toc-head` at 1280×720, 844×390, 390×844 and 1920×1080; only the shortness of "Contents" hid it. Clearance is now 20–34px.
- **Chrome Is Not Prose.** `.reveal ul`, `.reveal ul > li` and its `::before` tick reached the TOC list (56ch cap, 1.5em indent, a green tick per row). A bare `.toc-list` reset (0,1,0) lost to `.reveal ul` (0,1,1) and never applied.
- **Border-Box Chrome.** `.toc-panel` sized its content box: 423px on a 390px phone, with the close button 14px off screen, and 1062px on desktop against a stated 960px.
- **Fixed Canvas.** `--block-max-h` replaced two `62vh` literals (the `.figrow` image and `pre code`): 28rem is 62vh taken once at the 720px reference height. A vh cap measured the window, so the same slide held a different amount of image on a laptop, a projector and a phone.

## Elevation & Depth

- `shadow-1` was retired when its last two users (a row of book covers and a demo QR) turned out to be the retired card in disguise.

## Shapes

- **Process flow.** `.flow-step` carried a 1px Line border and `--radius-md`: three bordered boxes joined by arrows, the one composition on the showcase an unrelated product could have shipped unchanged. Steps now open on the 4px rule, separated by `--space-xl` (up from `--space-xs`).
- **Code block and scroll panel.** `.reveal pre` dropped its hairline in one pass; `.scroll-panel`, the same construction, was missed and fixed in the next.
- **Rule Opens From Above.** Flush under a chart, `.marginnote`'s 3px rule read as one more unlabelled bar in the series.
- **Rules Line Up.** At its 60ch measure, a callout after `.stat-grid` ended its rule 32px past the ledger column above it.

## Components

- **Print imprint.** Before `buildPrintImprints()`, the single live footer was parked at the tail of the last page with whatever folio was current at export: one wrong number and sixteen blank ones.
- **Scroll view chrome.** `position: absolute` measured the footer against a `.reveal` one viewport tall, so it scrolled off after the first screen. The folio froze at `01 / 01`, and `buildTOC` built an empty overlay on one deck and a one-entry overlay on another, because reveal re-parents slides out of the selector `getHorizontalSlides()` reads. Teaching the folio to read scroll pages would be a rework, so the counter, running head and overlay are removed there instead.
- **Inline highlight.** At 0.06em (1.4px) padding the wash stopped flush against the glyphs and read as a printing error.
- **Progress bar.** A green bar on the green divider drew at 1.28:1 against its own field; the track rose from 1.23:1 to 1.61:1.
- **Closing byline.** Without the logo pushed to the foot of each author block, marks landed at different heights and the row read as two stacked cards.
- **One Bar.** The `.site-frame` and `.chrome` bars had drifted 0.05rem of padding and 0.1rem of label inset apart before they were declared once. `.chrome-open` was styled the day `.chrome` was written (29 June 2026) and never used.
- **Frame bar as `<figcaption>`.** A bar authored as `<figcaption>` inherited `max-width: 52ch` (about 413px, truncating the URL), a top margin and the italic serif. The theme now neutralises all three on the shared bar.

## Motion

- **One keyframe.** The share-bar fill animated `width` under its own `grow-right` keyframe before it was folded into `rule-draw`. The column chart keeps `height` on purpose: its numeral rides the bar (447px → 247px measured on the peak bar).
- **One stiller.** There were three stiller lists in three selector grammars; `.no-draw` reached five of six marks, so a `.no-draw` deck still drew its divider plate rules and chart bars and every count ran.
- **Reduced motion.** The rule once zeroed every `transition-duration`, which turned the viewport's 360ms paper-to-graphite cross-fade into a hard cut on every section divider.
- **Inline style wins.** Reveal writes `transition: transform 0.8s` inline on the viewport, so the theme's cross-fade never ran until it took `!important`.
- **Focus.** `transition: all` swept `outline-color` and `outline-offset` into the 220ms ramp, so the ring arrived late. In-slide links fell back to the browser default at about 1.5:1 on the navy closing.

## Tables

- `0.9em` horizontal padding resolved against each cell's own size: a header at 0.82em and a body cell at 1em drew 12.4px and 17.0px gutters, and a right-aligned header sat 4.6px inboard of its numerals. An earlier reading blamed trailing letter-space; measurement showed the em mismatch. With the container-measured gutter both end at 1186.2px.

## Print

- **Paper Cannot Scroll.** The PDF used to hard-cut a `.scroll-panel` mid-sentence with no mark, under copy still telling the reader to scroll.

## Deck CSS checks

Two lessons from the hand sweep that preceded the audit checks. A rule parser that never reset its brace depth read one rule per stylesheet and reported every deck clean, which is why each check now carries a known-bad fixture. A contrast probe that round-tripped a colour through canvas `fillStyle` read OKLCH components as RGB and invented failures; paint the colour and read the pixel back. The landing page's `transition: all` on its Open cue outlived every deck's before site pages were brought under two of the checks.

## Brand skin: ZMO

- **One left edge.** The PPT insets its text boxes 0.1in (12.8px) inside the frame while cards, callouts and figures sit on the frame edge, so the lead line started 13px right of the card under it on almost every slide. The skin now starts title, lead, running text and every box at x 64.
- **Radii.** Boxes now share `--zmo-radius` (16px) and browser frames `--zmo-radius-frame` (8px).
- **Type floor.** The frame bar's URL and Open link, the QR URL and the card foot were raised to `--fs-caption` (10pt); the foot URL and folio stay at the PPT's 9pt.
- **Sparse boxes.** Stretched cards and lone callouts with little content read as half-empty panels; centring a lone callout and balancing sparse card rows replaced top anchoring for those cases only.
- **Flow arrows** moved to `--zmo-blue-grey` (3.51:1 on white), and `.stat-grid` gained 24px below it.
- The skin's components (`.matrix`, `.tiers`, `.pill-row`, the QR helpers and others) were first drawn by hand in the 12 November 2026 unit deck and then promoted into `zmo.css`.
