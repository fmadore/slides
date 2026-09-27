# Repository review — 26 September 2026

A full pass over the engine (`shared/src/`), the landing and 404 pages, the
Python and Node tooling, CI, and the published decks' generated metadata. The
baseline was green: 124 Python and 14 Node tests, a strict audit with zero
findings, and all eight decks passing the browser checks at 1280×720, 844×390
and 390×844. Everything below was found by reading the code and then
reproducing it in a browser or a test; nothing was changed on inference alone.

Published decks' slide content was left alone (Product Principle 3). The decks
changed only inside their generated `DECK_META` blocks.

## Fixed

**Engine**

- *The contents dialog swallowed the keys its own footer advertises.* The
  footer reads "T contents · O overview · Esc close", but the dialog's capture
  handler stopped every key, so T could open the contents and never close them,
  and O did nothing. T now toggles closed and O hands over to the overview. A
  browser check presses both; run against the previous bundle it fails at the
  second T.
- *Copying a slide link gave a sighted presenter no feedback.* The only
  confirmation was a visually hidden status line, and it never cleared, so a
  second copy was not re-announced either. The button's link glyph now becomes
  a tick for 2.4s — colour and glyph, no movement, following the field it sits
  on — and then both reset.
- *Six interface strings bypassed the I18N table.* They were spelled out as
  `LANG === "fr" ? … : …` at their call sites (copy link, image loading and
  failure, the live-frame fallback), so a third language would have silently
  missed them. Every engine string now lives in `I18N`.

**Landing page**

- Heading outline skipped a level (h1 → h3): "The talks" is now the h2.
- Keyboard focus on a talk showed only an outline; hover also turned the title
  green and revealed the Open cue. Focus now gets everything hover gets.
- `.talk-go` used `transition: all` (DESIGN.md: *Don't*), and the page had no
  reduced-motion treatment. Transitions are named; under
  `prefers-reduced-motion` the row no longer leans in and the cue no longer
  slides, but the colour feedback stays (DESIGN.md: *take the displacement
  away*).
- Read / PDF / Event links were 16px tall, under the WCAG 2.2 AA 24px target
  minimum (2.5.8). They now measure 29px, with no change to the row's layout.
- "Clear filters" was an unstyled system button; it now speaks in the 404
  page's voice (gothic caps over a green rule). Links in the extras row and the
  navy colophon get a themed focus ring (paper on navy, as in the decks).
- On a phone the filters wrapped at their natural widths; they now form a
  squared two-column block.
- Search now finds a talk by its tags, venue and fuller in-deck title, not only
  by what the row shows ("OCR" found nothing before).
- A JSON copy of the manifest was embedded in the page for the filters, which
  never read it (they read each row's `data-*`). Removed.
- The sitemap now gives the landing page a `lastmod` (the newest talk's date).

**Citation metadata (new).** Each deck's generated head now carries Highwire
`citation_*` tags, which Zotero's connector and Google Scholar read. With them
Zotero saves a deck as a conference paper named for its event, with
`slides.pdf` attached; with `citation_title` alone it would guess "journal
article" (checked against Zotero's *Embedded Metadata* translator). The JSON-LD
gained the owner's ORCID, the event URL, the social card and the PDF, and every
card an `og:image:alt`. No licence is asserted in metadata: the decks mix
CC BY 4.0 text with third-party images, and one licence field would overclaim.

**Audit and tests**

- `tools/audit.py` now holds the landing and 404 pages to the two CSS rules
  that hold on any page (`transition: all`, hand-spelled corporate hex). The
  landing page's `transition: all` had survived because only `talks/` was
  checked; the new check reports it against the old page. `docs/` and
  `scratchpad/` joined the never-publish list.
- New `tools/test_build_index.py` (escaping, search coverage, outline, sitemap,
  the `--check` gate) and `tools/test_check_links.py` (the weekly link check's
  grading, run against a local server: gone is dead, bot walls are unverified,
  HEAD-refusers get a GET, blips are retried). Neither tool had tests; the link
  check is the only thing that notices link rot.
- Citation metadata tests in `tools/test_manifest.py`; the browser journeys
  cover the contents keys, the copy confirmation, search by tag, shared filter
  URLs and the heading outline.
- 156 Python tests (was 124), 14 Node tests.

**Housekeeping.** `scratchpad/` (91 files, 5.7 MB of screenshots and one-off
scripts) had been committed with the September hardening pass, although the
commit after it set out to ignore the repo-root scratch directory; it is
removed and ignored. `serve-deck.py` takes `--port` and `--host` and stops
cleanly on Ctrl+C. The manifest comment now lists `deckTitle`.

## Recommended, not changed

These are judgement calls that belong to the author, or need a dependency.

1. **Favicon.** Every page uses `shared/logo-africamultiple.png`, a 780×192
   wordmark. Squeezed into a 16px tab icon it renders about 4px tall, which is
   unreadable. A square mark would fix it — either the house signature (a green
   marker bar over ruled lines) or a cropped institutional mark. It is a brand
   decision (PRODUCT.md names the wordmarks as identity assets), so it is left
   open.
2. **Four slides run below the 0.90 readability floor by exemption.** DGA cover
   ×0.861, "The scanning party" ×0.868, "NotebookLM" ×0.886, and Rhodes "The
   Cluster" ×0.875, each with a `data-fit-allow` reason. The hall is the
   primary reader, and the cover's title is the line read from furthest away.
   Trimming them is a content edit to a delivered talk.
3. **Automated accessibility checks.** WCAG 2.2 AA is binding, but only alt,
   title and focus rules are enforced. `axe-core` run over the landing page and
   one slide per layout in `browser-check.mjs` would catch contrast and ARIA
   drift. It is a new pinned dev dependency, so it is left to a decision.
4. **One validation command.** Local validation is six commands. An
   `npm run validate` would have to find a Python launcher (`python3`, `python`
   or `py` on Windows), which needs a small Node wrapper to do portably.
5. **CI time.** Every job downloads Playwright's Chromium. Caching
   `~/.cache/ms-playwright`, keyed on `package-lock.json`, would save the
   download on the three jobs that install it. Separately, the `visual` job
   passes `--decks _template` while its screenshots always come from
   `_showcase`. The flag only narrows the fit checks, but it reads as though it
   chose the catalogue.
6. **Landing-page numbering.** Rows are numbered 01 = newest, so every new talk
   renumbers the archive. A reversed count (the seventh talk stays 07) would
   let a number identify a talk. This is a design choice, not a defect.
7. **Dependabot** covers npm and Actions but not `requirements-dev.txt`
   (`qrcode[pil]`, authoring-only). A monthly `pip` entry would keep it in
   view.

## Carried over from the August roadmap notes

The notes in the removed `scratchpad/issues/` were checked against the current
tree. The footer logo (22× oversample) and the per-deck CSS sweep are resolved:
the logo is now 780×192 / 18 KB, and the sweep became the audit's CSS rules.
Two notes were still open:

- **Stocked but unused vocabulary.** `.chrome-open` has already been removed
  from the theme; only a comment in `05-embeds-code.css` records it.
  `.panel.sunken`, `.chrome` and `.no-draw` appear only in `_showcase`.
  `.panel.sunken` is DESIGN.md's reference surface, and `.no-draw` is exercised
  by the motion-switch check, so "unused" does not mean "delete".
- **Parked passes** (`delight`, a data-viz pass on `07-data-viz.css`,
  `extract`) remain parked until a deck gives one a reason.

Validation for this pass: all Python and Node tests, `build-index.py --check`,
`audit.py --strict` on the source and on a stripped build, and the full browser
check at three viewports, including the interaction journeys.

## Follow-up — 27 September 2026

The first batch deployed cleanly. Six of the seven recommendations were then
taken up; the seventh is left with the author.

1. **Favicon.** The tab icon is now the house mark (`shared/favicon.svg`, with
   32px and 180px PNG fallbacks): a paper page, the green marker bar and a
   near-black headline. It was chosen over ink-ground and green-ground drafts
   because it is the only one that stays legible at 16px on light and dark tab
   strips alike. Every page, the starter template included, links it.
2. **Four slides under the 0.90 floor.** None of the four exemption reasons
   described its slide ("cover artwork", "photographic collage", "network
   diagram" — there were none). Three are fixed by layout alone, every word
   kept:
   - the DGA cover moves its QR to the corner, as its closing already does:
     ×0.861 → no fitting at all;
   - "The scanning party" caps its two zoomable images at 220px instead of
     292px: ×0.868 → ×0.969;
   - "NotebookLM" sets its demo QR beside its label: ×0.886 → ×0.958.

   The fourth, Rhodes "The Cluster", stays exempt, now with an honest reason.
   Its six-line lead at the 30ch measure makes the left column 85px taller than
   the safe area. Tightening spacing reaches only ×0.905, which is too close to
   the floor to hold across machines. Clearing it needs either a shorter lead
   (it restates the callout beside it) or a measure DESIGN.md forbids outside
   the closing. Both are the author's call.
3. **Automated accessibility checks.** `axe-core` (pinned) runs in
   `browser-check.mjs` over every slide with its fragments shown, its footer,
   the open contents dialog, the landing page at two widths and the 404. It
   awaits every finite animation first, so a fade is never measured halfway.
   Its first pass found three kinds of failure, all now fixed:
   - scroll panels a keyboard could not reach (WCAG 2.1.1);
   - links marked by colour alone, the underline having been designed but set
     to `none` (1.4.1, Level A);
   - two captions in `--ink-faint` on tinted grounds (4.26 and 4.38:1).
   Run against the previous engine, the check reports those failures. The
   ghosted folio, an aria-hidden decoration, is the only exclusion.
4. **One validation command.** `npm run validate` runs every CI check in
   order and keeps going after a failure. It finds Python on any platform
   (`python3`, `python`, Windows `py -3`, or `SLIDES_PYTHON`).
5. **CI.** `.github/actions/setup-playwright` restores Chromium from a cache
   keyed on the lockfile; the system packages are still installed each run.
   The visual job's `--decks _template` now carries a comment saying what it
   narrows.
6. **Landing-page numbering.** Each talk's number is now its own, counted from
   the first talk and rendered by `build-index.py`. A new talk takes the next
   number, and filtering no longer renumbers the list.
7. **Dependabot** now proposes monthly bumps for `requirements-dev.txt`, and
   watches the new local action as well as the workflows.
