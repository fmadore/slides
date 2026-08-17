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
