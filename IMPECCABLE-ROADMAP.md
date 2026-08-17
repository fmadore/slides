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

Produce one prioritized findings list; change nothing yet.

1. **`/impeccable critique talks/_showcase/index.html`** — heuristic design
   review of the full layout vocabulary.
2. **`/impeccable audit talks/_showcase/index.html`** — technical checks:
   contrast on the green/navy fields (AA at projector distance), focus states,
   reduced motion, small screens, print/PDF fidelity.
3. **Mechanical detector** over the theme modules and the showcase (the
   `detect.mjs` invocation is printed at session start; don't hardcode the
   versioned plugin path).
4. **Capture the "before" screenshots** for all five talks plus showcase and
   template: `node tools/browser-check.mjs --screenshots <dir>`. This is the
   baseline arm for every visual-diff in Phase 2.

Triage the combined findings into: system fixes (theme modules), showcase/
template fixes, and per-deck fixes. That triage decides which Phase 2 passes
are actually needed and in what order — the sequence below is the default,
not a quota.

## Phase 2 — System-level refinement passes (shared theme)

One command per session, each mapped to the theme modules it touches. These
are *refinements*: Broadsheet is the committed world; every pass preserves its
identity.

| Pass | Command | Primary modules | What it hunts |
|---|---|---|---|
| 1 | `typeset` | `01-foundations` | The type system is the core of Broadsheet: scale and optical letterfit at hall distance, EB Garamond's small x-height, tabular figures, French/German diacritics in the black-weight gothic |
| 2 | `layout` | `03-layouts` | Spacing rhythm and alignment across `.cols`, `.figrow`, the index/ledger components; consistent optical margins |
| 3 | `polish` | `02-components`, `04-chrome` | Consistency of rules, ticks, chips, kickers; dark-field legibility; running head/footer detail |
| 4 | `animate` | `09-flow-motion` | Extend the "ink-on-paper" signature (`--draw`: rules draw, bars grow, figures count) purposefully; keep `prefers-reduced-motion` honest |
| 5 | `harden` | `06-responsive-print` + all | Long titles, overflow, weak-beamer contrast, PDF export edge cases, very long affiliation lines |

Deferred until a concrete need appears: `delight` (only if a pass surfaces a
genuine opportunity), a data-viz pass on `07-data-viz.css` (when a talk next
needs charts), `extract` (only if components outgrow the theme file).

**Deliberately not on the roadmap:** `colorize` (the colour strategy is
already committed), `bolder`/`quieter` (Broadsheet's register is calibrated;
changing it is a new-work decision, not a dial), `overdrive`, `onboard`,
`distill`, `optimize` (no performance problem), `craft` (deprecated alias).

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
