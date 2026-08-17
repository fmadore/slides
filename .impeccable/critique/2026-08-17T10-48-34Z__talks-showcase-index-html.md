---
target: talks/_showcase/index.html
total_score: 28
max_score: 36
na_heuristics: 9
p0_count: 1
p1_count: 4
timestamp: 2026-08-17T10-48-34Z
slug: talks-showcase-index-html
---
Method: dual-agent (Assessment A: design review, browser-measured · Assessment B: detector + deterministic evidence). A third agent ran the technical `audit` in parallel. All major claims independently re-verified by the parent before reporting.

## Design Health Score — 28/36

Heuristic 9 (Error recovery) scored `n/a`: a linear deck presents no user-input error states. Applicable maximum 36.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Slide counter and progress hairline good; no *fragment* progress, so neither presenter nor room knows more is coming |
| 2 | Match system / real world | 4 | Broadsheet metaphor used correctly; one placeholder addresses a web reader ("Click the image to enlarge") in a hall |
| 3 | User control and freedom | 3 | TOC opens scrolled to current item, no top edge or scroll cue; entries 01–07 invisible with no hint |
| 4 | Consistency and standards | 2 | `.metric`/`.cover` don't centre despite DESIGN.md saying they do; `.flow-step` and `pre` are cards against Ruled-Not-Boxed |
| 5 | Error prevention | 2 | The catalogue ships two recipes broken on copy (fragments, `.metric`) — this is the file every talk copies |
| 6 | Recognition over recall | 3 | Three competing orientation signals per slide; `.section` dividers drop the runhead where orientation matters most |
| 7 | Flexibility and efficiency | 4 | S/T/B/F/ESC/search all work; discoverable only inside the TOC footer |
| 8 | Aesthetic and minimalist | 3 | Cover carries role+affil+logo+5 links+QR+label at once; identical green opener on 9/24 slides |
| 9 | Error recovery | n/a | No user-input error surface in a linear deck |
| 10 | Help and documentation | 4 | Inline HTML comments are outstanding; one stale (line 92 says "big serif title" — it is Libre Franklin 800) |

Audit Health Score (separate technical pass): **12/20 — Acceptable.** Accessibility 2, Performance 3, Responsive 3, Theming 2, Implementation Integrity 2. Integrity verdict: FAIL.

Cognitive load: **4 of 8 checklist items fail** — grouping/proximity, visual hierarchy, one-thing-at-a-time, progressive disclosure.

## Design Specificity Verdict

**Mostly authored for this product (7/10), with two clear flinches.**

The inverted hierarchy is load-bearing, not a claim: h1/h2 at weight 800, −0.028em tracking, 0.98 line-height, all prose in EB Garamond 500. Colour genuinely arrives as a field — three full-bleed planes across 24 slides, gold in exactly three places. The retired anti-references are genuinely retired: zero rainbow bar, zero compass, zero tinted takeaway boxes, zero decorative gradients. The broadsheet vocabulary is used rather than referenced (decimal-leading-zero folios with dotted leaders, Fig. marks, dateline, colophon, tabular lining figures).

The flinches: (1) confident on dark, timid on white — the 18 white slides are a top-anchored left column above 250–350px of unclaimed space, which reads as *the template ran out*; (2) `.flow-step` is three bordered rounded boxes joined by arrows on the slide captioned "A process, drawn — not bulleted" — the one slide an unrelated product could use unchanged.

**Deterministic scan:** 40 findings on the showcase, 10 on the template, 5 on deck.js, 59–101 per published deck. The overwhelming majority are false positives against this project's documented system (heavy editorial rules read as `side-tab`; display leading of 0.98 read as `tight-leading`; reveal's `data-src` lazy loading read as `broken-image` ×60; derived tokens read as off-palette colours). Verified genuine: `--ink-faint` on `--sunken` at 3.96:1, `.kvm-tag` at 0.62rem below the type ramp, hard-coded `#211f1d`, off-scale radii.

**Detector reliability caveat (verified by hand):** the static engine cannot resolve this theme's `var()` tokens and falls back to reveal.css's base `.reveal-viewport{color:#000; background-color:#fff}`. It reports `#000000 on #002481 = 1.6:1` where the true value, computed with the detector's own `contrastRatio`, is **13.05:1**. Its contrast noise is inverted: it flags what passes and misses what fails.

## What's Working

1. **The dark-field register is the real thing.** `.section`, `.section.navy` and `.closing` each stack four structural devices — full-bleed plane, 4px gold plate rule, oversized ghosted folio, 97.6px gothic title with italic serif subtitle. They work because the One Gold Spark Rule is genuinely obeyed. They are also the most beamer-robust pages in the deck.
2. **`.statement.quote` earns the type inversion instead of asserting it.** The only slide with no gothic at all; every other slide spends the gothic, this one spends its absence.
3. **Follow-through is real, not claimed.** Zero WCAG AA failures among in-slide text across all 24 slides; `prefers-reduced-motion` genuinely stills the signature motion; every image has alt and intrinsic dimensions; the TOC overlay is a correctly implemented modal (focus trap both directions, Escape, focus restored, `aria-current`).

## Priority Issues

**[P0] The label tier is print-scaled, not hall-scaled — and it carries the meaning.** → `typeset`
Measured on the 1280 canvas: `.stat-label`/`.chip`/`.bar-axis`/`figcaption` 12.8px, `table th` 11.5px, `pre code` 12.5px, `.kicker` 13.1px. Slide 08 projects "12,480" at 35px above "DOCUMENTS" at 12.8px: the audience writes down a number and cannot see what it counts. This passes WCAG and fails comprehension. Fix: split the tier — keep 0.82rem for true chrome, add a hall tier at ~1.05–1.15rem with tracking eased to ~0.10em for labels that carry meaning.

**[P1] `.on-dark` footer chrome fails AA on the green section-divider field.** → `colorize`
Found independently by two agents with different methods: footer text 3.04–3.51:1, `.foot-title` 2.72–3.24:1 against a 4.5:1 requirement. One `.on-dark` class serves three fields of very different luminance; the values were tuned against navy (which passes at 8.83:1) and never re-checked against the much lighter green. Live on every section divider in every deck. The same root cause produces the focus-ring failure below and the `.media` failure.

**[P1] The nav-button focus ring is invisible on green fields.** → `colorize`
`04-chrome.css:64` sets `outline: 2px solid var(--green)` with no `.on-dark` counterpart, though hover, border and colour all flip. Measured 1.28:1 on `--green-field`. WCAG 2.2 1.4.11 and 2.4.7. Separately, in-slide links get no themed ring at all — the browser default measures ~1.5:1 on the navy closing field, affecting the first and last slide of every deck.

**[P1] The catalogue ships two recipes that break the moment they are copied.** → `harden`
(a) `<li class="fragment highlight-green">` measures `opacity: 1` at fragment index 0 — reveal's `highlight-*` is a state change, not an entry — so the room meets bullet 4 alone above three empty gaps, before any premise. (b) `.reveal section.metric { justify-content: center }` is inert because reveal forces `display: block` on `.present`; only `.balance.present` restores flex. This is the file every future talk copies from, and published decks are never individually redesigned.

**[P1] `62vh` inside the scaled canvas breaks the Fixed Canvas Rule.** → `harden`
`03-layouts.css:177` and `05-embeds-code.css:11`. DESIGN.md states verbatim "Never use vw/vh/clamp() for slide content." The consequence is concrete: the same slide has different content height on different displays, so CI at 1280×720 structurally cannot catch a fit failure that appears on the presenter's laptop.

**[P2] `.marginnote`'s rule reads as a data bar directly under the chart.** → `clarify`
`08-image-editorial.css:58` — `border-top: 3px solid var(--rule)` with no `margin-top`. Measured flush against the last `.share-track`, spanning 75% of the column. The room reads a seventh country and hunts for its label — on the slide whose argument is "the thin bars *are* the bias disclosure."

## Persona Red Flags

**Sam (accessibility-dependent):** in-slide link focus ring is the browser default at ~1.5:1 on navy (2.4.11, 2.4.7); TOC toggle reports no `aria-expanded`/`aria-controls` (4.1.2); `.media` footer sits over unprotected image; no skip link — first Tab stop is the cover's five contact links; `.sec-no` at 1.52:1 conveys information but is styled as decoration.

**Jordan (attendee meeting the material cold):** slide 12's out-of-order reveal reads as "the tech is failing", and that lands on the speaker; reads the marginnote as a seventh data bar; three competing orientation signals per slide, yet dividers drop the runhead entirely.

**"Professor Hübner," 62, row 20, weak beamer** (project-specific, from PRODUCT.md): the `--line` hairlines are ~1.15:1 in luminance against paper and simply do not exist on a hazy projector. The index-list row rules, the ledger baselines, the table rules and `.panel` structure all vanish; only the 3px near-black rules survive. **"Ruled, not boxed" degrades to "a few heavy rules and floating text."** The hero register (dividers, statement, quote, metric, chart shapes) is excellent for her; the editorial register (hairlines, labels, captions, tables, code) is authored for a printed page at 40cm and she loses all of it.

## Minor Observations

Right-aligned tracked table headers carry trailing letter-space (ITEMS ends at 1194, numerals at 1189). Stale comment at showcase line 92 ("big serif title" — it is Libre Franklin 800). TOC shows two number columns side by side. `.hl` has only 1.46px horizontal padding. `.deck-footer` is a plain div with no landmark role. Slide 21 titled "Two image types, one system" uses two different caption systems and two different bottom edges. Three different right edges in one region on slide 08. Seven documented affordances ship unused, including `.panel.sunken` — which DESIGN.md calls "the only sanctioned surface".

## Questions to Consider

1. Why does the system reserve its full confidence for dark fields? What would a white slide look like if it were as committed as the divider?
2. A broadsheet is read at 40cm; this one is read at 20m. Are the hairline and the 0.82rem label tier the two places where the metaphor is obeyed *against* the primary reader?
3. Whose interest does the colophon serve? Would a citation block (DOI, CC BY, "cite as") serve the "durable, citable research output" goal better in the same space — and give the deck an end that matches its peak?
4. If `.balance` is required for hero layouts to behave as documented, is it a helper or the actual layout contract?
5. What is this theme's answer to a slide with three short bullets? Today it is "leave 350px empty." If it were "then the type is bigger," the hall problem and the composition problem collapse into one fix.
