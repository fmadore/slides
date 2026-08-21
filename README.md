# Slides — Frédérick Madore

Conference talks, lectures and keynotes by **[Frédérick Madore](https://www.frederickmadore.com/)** —
historian of Islam in West Africa and data curator at the [Africa Multiple Cluster of
Excellence](https://www.africamultiple.uni-bayreuth.de/en/index.html), University of Bayreuth.
The decks range across Islam in West Africa, digital humanities, artificial intelligence, and
the **[Islam West Africa Collection (IWAC)](https://islam.zmo.de/s/westafrica/)**.

Built as offline-capable [reveal.js](https://revealjs.com) decks on a shared **“Broadsheet”**
theme, using the Africa Multiple Cluster of Excellence logo and the University of Bayreuth
colour palette.

**Live: <https://slides.frederickmadore.com/>**

---

## Design philosophy — “Broadsheet”

A bold scholarly broadsheet, not a slide template. Three rules carry the whole system:

1. **Inverted type hierarchy.** The newspaper-gothic (**Libre Franklin**, pushed to its
   black weights) is the *loud* display voice — headlines, section numbers, statements,
   set big and tight. The humanist book serif (**EB Garamond**) is the *quiet*
   counter-voice — body prose, leads and quotations. This is the reverse of a
   conventional academic deck, where a serif leads and a gothic is reduced to tiny
   labels. One pair of (variable, self-hosted) fonts; opposite personality.
2. **Colour is a field, not a sprinkle.** The Bayreuth palette is spent as flat
   structural planes and heavy rules, never as a timid accent wash. **Green leads**
   (full-bleed section dividers, the marker bar above every slide title, folios and
   links), **navy is the deep pole** (the closing field and the alternate divider),
   and **gold is the single spark** (plate rules on the dark fields).
3. **Crisp, high-contrast page.** Near-black ink on a cool near-white — no warm-paper
   wash. Structure is drawn with confident 3–6px rules instead of faint hairlines.

**Signature device:** a heavy green marker bar sits above every standard slide title
(add `.no-rule` to drop it). Section numbers and metrics run oversized.

The design system is recorded in [`DESIGN.md`](DESIGN.md) — tokens, named rules and
component specs derived from the shipped theme (machine-readable sidecar in
`.impeccable/design.json`) — and the durable product context in [`PRODUCT.md`](PRODUCT.md).

---

## Structure

```
slides/
├── index.html            ← landing page (GENERATED from talks/talks.json)
├── shared/               ← the reusable ENGINE, one copy shared by every talk
│   ├── theme.css deck.js     GENERATED public bundles (stable deck URLs)
│   ├── src/
│   │   ├── theme/            focused CSS partials: foundations, layouts, chrome…
│   │   └── deck/             focused JS partials: TOC, fitting, embeds, diagnostics…
│   ├── highlight.min.js      slim vendored highlight.js (see vendor-manifest.json)
│   ├── logo-*.{png,svg}      Africa Multiple, Bayreuth, KCL marks
│   ├── assets/               images used by more than one talk
│   ├── fonts/                self-hosted EB Garamond + Libre Franklin (offline)
│   └── reveal/               vendored reveal.js v6 + plugins (offline)
├── talks/
│   ├── talks.json            ← the TALK MANIFEST (one record per published talk)
│   ├── _template/            minimal starter (tools/new-talk.py copies this)
│   ├── _showcase/            the full layout catalogue (never published)
│   └── YYYY-MM-DD-place-title/
│       ├── index.html            (slides + DECK_CONFIG; points to ../../shared)
│       └── assets/               (this talk's images / embedded files)
├── tools/
│   ├── new-talk.py           scaffold a talk (slug, metadata, manifest, QR)
│   ├── build-index.py        render the landing page + sitemap from the manifest
│   ├── audit.py              one-command repository audit (static checks + tests)
│   ├── browser-check.mjs     Playwright checks at 3 viewport sizes
│   ├── visual-diff.mjs       tolerant screenshot comparison (CI)
│   ├── build-shared.mjs      assemble/check the stable shared bundles
│   ├── export-pdf.mjs        per-deck slides.pdf + social-card.png, and the
│   │                         landing page's own card (CI)
│   ├── check-links.py        external links in published decks (weekly, not CI)
│   ├── strip-notes.py        allowlisted, notes-free publication build (+ tests)
│   ├── fetch-highlight.py    regenerate the slim highlight.js bundle
│   ├── fetch-fonts.py        transactionally re-vendor fonts + checksums
│   ├── lib/                  shared Node runtime/server/cache helpers
│   └── slideslib/            validated manifest + generated deck metadata
├── package.json lock         pinned browser/visual tooling and local scripts
├── requirements-dev.txt      pinned QR-generation dependency
├── serve-deck.py             ← no-cache dev server (serves the whole repo)
├── .github/workflows/        pages.yml — validate, build and deploy
│                             link-check.yml — weekly link rot check
└── .nojekyll  CNAME  404.html  robots.txt  sitemap.xml  LICENSE.md
    THIRD_PARTY_NOTICES.md  CITATION.cff  PRODUCT.md  DESIGN.md  README.md
```

Each talk references the one shared engine via `../../shared/…`, so a fix to `theme.css`
or `deck.js` updates **every** talk. All paths are relative, so the site works whether it is
served from the custom domain or a subpath — `fmadore.github.io/slides/` still resolves and
redirects to `slides.frederickmadore.com`.

---

## Add a new talk

One command scaffolds everything:

```bash
python3 tools/new-talk.py \
  --date 2026-09-01 --place bayreuth \
  --title "My talk" --venue "Conference · Bayreuth · 1 Sept 2026" \
  --event "Conference · Bayreuth" --desc "One-line description." --lang en
```

It copies `talks/_template`, fills the metadata (DECK_CONFIG, cover, canonical
URL + social metadata), registers the talk in [`talks/talks.json`](talks/talks.json),
regenerates the landing page and writes a QR code pointing at the final URL
(install once with `python -m pip install -r requirements-dev.txt`). The entire
deck is staged first; if generation fails, the manifest and generated site files
are rolled back. `--dry-run` validates without writing, and `--no-qr` deliberately
removes the QR markup and avoids the Python dependency.
Then edit the slides; the full layout catalogue with copy-paste examples lives
in `talks/_showcase/` (preview at `/talks/_showcase/`).

Doing it by hand instead: copy `talks/_template`, add an entry to
`talks/talks.json`, and run `python3 tools/build-index.py`. The marked SEO and
DECK_CONFIG metadata blocks are generated from the manifest; use optional
`deckTitle` when the in-deck title should be longer than the landing-page title.
Edit slide content outside those generated markers.

---

## Preview locally

Decks must be served over HTTP (not `file://`). From the repo root:

```bash
python serve-deck.py          # no-cache server → http://localhost:8742
```

Open `http://localhost:8742/` for the landing page (rendered statically from
`talks/talks.json`, with client-side search and language/year/topic filters
whose state lives in the URL), or a talk directly at `/talks/<slug>/`. The no-cache server guarantees reloads always show your latest edits.
(For just viewing, any static server works, e.g. `python -m http.server`.)

---

## Using the deck

**Keyboard:** `←/→` navigate · `T` table of contents · `O` overview · `F` fullscreen ·
`S` speaker notes · `Esc` close overlays. On-screen ‹ › buttons and a **Contents** button
sit in the footer.

**Layouts** (see `talks/_template/index.html` for live examples): cover, section divider
(`.section` green field, `.section.navy` deep variant), standard content, numbered index
(`.index-list`), two-column (`.cols`, `.cols.ratio-3-2`), big statement (`.statement`,
`.statement.quote`), oversized metric (`.metric`), code (`<pre><code class="language-…">`),
full-bleed media (`.media`), figure + text (`.figrow`), framed website (`.site-frame`),
closing (`.closing`). Helpers: `.kicker` (`.warm`/`.navy`/`.green`), `.callout`
(`.warm`/`.navy`/`.green`), `.stat`, `.chip`, `.panel`, `.balance` (vertically centre a
sparse slide), `.no-rule` (drop a title's green marker), `data-toc="…"` to add a slide to
the table of contents, `<aside class="notes">` for speaker notes.

**Bylines & co-presenters.** The cover and closing carry a `.byline`: a `.name`, an optional
`.role` (job title), and an `.affil`. For a co-presented talk, swap it for the stacked
`.byline.authors` variant — one `.author` block per presenter, each keeping its own
affiliation — delete the `data-contact` row (it renders one person's links), and list every
name in `DECK_CONFIG.presenter` so the TOC footer matches. `_template` ships this as a
commented block on the cover.

**Build slides up incrementally** with reveal's fragments: add `class="fragment"` to any
element and it steps in on the next ←/→ (variants in the theme: `fade-up`, `highlight-green`;
`data-fragment-index="n"` controls order). For a smooth morph between two slides, put
`data-auto-animate` on both `<section>`s and give the shared elements the same `data-id` —
reveal interpolates position, size and style (a heading shrinking from centre to top, a
growing number, an evolving diagram). Both are demonstrated in `_template`. Press `B` (or
`.`) any time to black out the screen mid-talk.

**Write slides in plain HTML.** Every slide is a `<section>`; slide-level attributes
(layout `class`, `data-toc`, `data-footer`) go on the tag, and the house classes above
style the content. Speaker notes go in `<aside class="notes">…</aside>` (press `S`). There
is no Markdown plugin — authoring is HTML only, so every slide stays fully under your
control and the markup carries no stray form elements. See `talks/_template/index.html`
for a worked example of each layout.

**Scrollable file embed** (e.g. a GitHub skill): a `<div class="scroll-panel"
data-embed-src="assets/file.md">` (the older `data-skill-src` still works) loads
and syntax-highlights a vendored file you can scroll on stage. Optional
`data-source-url` adds a link to the failure message and `data-error-message`
replaces it; loading and failure states are announced to screen readers. GitHub pages can't be `<iframe>`d, so vendor the file (also keeps it
offline). Refresh the IWAC skill snapshot with:

```bash
curl -fsS "https://raw.githubusercontent.com/fmadore/iwac-mcp-server/main/.claude/skills/iwac-mcp/SKILL.md" \
  -o talks/2026-06-15-luxembourg-beyond-keywords/assets/iwac-skill.md
```

**Framed live site** (e.g. a live website overview): a `<div class="site-frame">` gives a
browser-style chrome bar over a fitted viewport holding an `<iframe>`. Put it on a
`class="balance"` slide — reveal forces the active slide to `display:block`, which stops the
frame's `flex:1` from growing and collapses the viewport to 0 height; `.balance` restores flex
on the present slide so the frame fills. Note two more caveats — a live frame needs a network
connection (it isn't offline like the rest of the deck), and many sites refuse to be framed
(`X-Frame-Options` / CSP `frame-ancestors`); verify in a browser. If a site blocks framing,
drop a screenshot into the talk's `assets/` and swap the `<iframe>` for an `<img>` (the same
`.site-frame-view` styling fits both). See the "A framed website" slide in `_template`
(screenshot form) or "A live look" in the Luxembourg deck for the markup.

**Export to PDF:** the deploy workflow generates a notes-free `slides.pdf` for
every published deck (linked from the landing page). For a manual export, open
a talk with `?print-pdf` appended, then print → Save as PDF (Landscape,
margins None, background graphics on). The automated exporter first visits
each live iframe in presentation mode and substitutes a screenshot into the
PDF. If framing is blocked, it retries the URL as a temporary top-level page;
if the site is still unavailable, it prints a labelled live-content placeholder
instead of an empty white box. Run it locally with
`npm run export -- --root _site --force`; `--no-frame-snapshots` restores the old behavior and
`--frame-timeout-ms N` changes the per-frame timeout.

**Check slides fit:** open a talk with `?check` appended. Overflowing slides are
outlined in red with a banner, and the banner also shows the auto-fit scale the
engine applied to a dense slide (green ≥ 0.95, amber below, red below 0.90 —
a red slide fails validation unless you accept it explicitly with a
`data-fit-allow="reason for the deliberate exception"` attribute on its
`<section>`). Add `?no-fit` (or use `?audit`)
to disable auto-fitting and see the raw authored overflow. (All off in normal
viewing and export.)

**Syntax highlighting — slim build.** Talks load `shared/highlight.min.js` — a
slim vendored highlight.js (core + only the grammars the decks use, ~40 KB
instead of the 921 KB full plugin). `deck.js` highlights every `<pre><code>`
via `window.hljs`. To add a language, edit `LANGUAGES` in
[`tools/fetch-highlight.py`](tools/fetch-highlight.py) and re-run it (the
version + checksum are recorded in `shared/vendor-manifest.json`). A talk with
no code slides and no file embed can simply drop the `<script>` line.

**Figures show whole.** `.figrow` images use `object-fit: contain`, so a map,
manuscript or chart keeps its edges rather than being cropped. Add `class="figrow crop"`
for a photo you genuinely want to bleed/fill.

**Image assets: JPEG for photographs, PNG for flat art, never WebP.** Not a
browser-support rule — a PDF one. Chrome's print-to-PDF copies a JPEG into the
file byte-for-byte, but the PDF format has no WebP filter to copy into, so
every WebP is decoded and re-emitted as zlib-compressed RGB. Measured on the
Erlangen deck: 1.2 MB of WebP sources became **10.1 MB** of PDF images; the
same pictures as JPEG cost 1.7 MB. PNG round-trips at roughly its own weight,
so it stays the right choice for logos, QR codes, charts and anything with
transparency — as a palette PNG, not 32-bit RGBA (four QR codes shipped at
16–21 KB each; re-encoded to two colours they are under 1.5 KB).

Size images to what a deck can actually show. The slide canvas is 1280 px wide
and the lightbox tops out at 92vw, so **1800 px on the long edge** is the
ceiling for a zoomable `.shot`, and anything not zoomable needs no more than
3× the box it renders in (3× = a 4K projector showing the scaled canvas). A
1655×407 logo drawn at 75×18 in the footer is 22× more pixels than any screen
will ever ask for. `tools/audit.py` warns on WebP, on a raster over 1800 px,
and on one over 600 KB; CI's `--strict` turns those warnings into failures.

**A deck's own CSS is held to the theme's rules.** Per-deck CSS inherits
nothing, so a pattern the shared theme retired comes back the moment a deck
hand-rolls a component — which is how a `transition: all` that faded the focus
ring, a retired card and two type sizes below the theme's floor survived six
theme passes. `tools/audit.py` now reads every `<style>` block and `style=""`
attribute under `talks/` and fails on eight of the rules in
[`DESIGN.md`](DESIGN.md): viewport units or `clamp()` inside the scaled canvas,
`transition: all`, a shadow on in-flow slide content, the retired card shape (a
fill plus a hairline border plus a radius), a hand-written `font-size` under the
floor for where it sits (`--fs-caption` inside the canvas, `--fs-footer` in the
chrome), a corporate colour spelled out in hex where a token exists, hero
centring the theme already owns at `.present`, and an animation that does not
take its duration from `var(--draw-run)` (so no stiller can reach it). Each
check has a known-bad fixture in `tools/test_audit.py` that proves it still
fires.

**Customise the look:** edit the focused files under `shared/src/`, then run
`npm run build:shared`. The public `shared/theme.css` and `shared/deck.js` names
stay unchanged so every deck keeps working; `npm test` fails if either generated
bundle is stale. Design tokens live in `shared/src/theme/01-foundations.css`.
After changing the type choices, run `python3 tools/fetch-fonts.py` to download
all font responses before replacing anything and to refresh their recorded hashes.

**Responsive design.** The deck is responsive by reveal.js's design: a fixed 1280×720
canvas is uniformly scaled to fit any screen (`width/height/minScale/maxScale` in
`shared/deck.js`), so slides shrink to fit rather than reflow. That scaling *is* the
responsive mechanism — the type scale is therefore intentionally fixed `rem`, not fluid
`clamp(…vw…)`: viewport units would resolve against the real viewport and then be scaled
again by the canvas transform, fighting each other. The chrome that sits *outside* the
scaled canvas (footer, TOC overlay) is the only part that needs small-screen care, handled
by the `@media (max-width: 640px)` block and `clamp()` sizing in the overlay.

---

## Deploy (GitHub Pages)

Deployed by the **GitHub Actions** workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml).
On every pull request and push it first **validates**: the Python and Node unit
tests, generated bundle/metadata checks, then `tools/audit.py` itself (repo and built
site, strict) — dead local references, duplicate ids, missing `alt`/`title`,
stale placeholders, the landing-page/manifest sync check, the **per-deck CSS
rules** below and the **vendored checksums** in
[`shared/vendor-manifest.json`](shared/vendor-manifest.json) —
and finally Playwright browser checks of every deck at 1280×720, 844×390 and
390×844 (console errors, auto-fit failures, footer overlap). Pull requests
that touch the shared engine also get a screenshot-based visual regression
check, with diff images uploaded as workflow artifacts.

Only after validation passes does the **build** run: an allowlisted copy of
the site with **speaker notes stripped** (`tools/strip-notes.py` — the repo
keeps the notes, the artifact carries none and excludes all development
files), plus a generated `slides.pdf` and `social-card.png` per deck (cached,
regenerated only when the deck or shared engine changed).
Deployment happens only from `main`. Live at
**<https://slides.frederickmadore.com/>**.

> The source repository is public, so notes remain readable on GitHub even
> though they are absent from the live site. Truly confidential notes must
> live outside this repository.

Run the same validation locally:

```bash
npm ci
npm test
python3 -m unittest discover -s tools -p 'test_*.py' -v
python3 tools/build-index.py --check
python3 tools/audit.py --strict
npm run check:browser             # Playwright; uses installed Chrome/Edge as fallback
```

**Link rot** is checked separately by
[`.github/workflows/link-check.yml`](.github/workflows/link-check.yml), on a
weekly schedule rather than on pull requests: keeping CI hermetic means a slow
or unreachable third-party host can never make a PR flaky, but it also means
nothing would otherwise notice a link in a published deck going dead. The
weekly job probes every external URL and, when one is genuinely gone (404/410,
an unresolvable host, a refused connection), opens or updates a single
`link-rot` issue — and closes it again once the links resolve. Bot walls and
rate limits (403, 429, LinkedIn's 999) are reported as *could not verify* and
never raise an issue on their own. Run it yourself with:

```bash
python3 tools/check-links.py
```

Node tooling and Action versions are kept current by
[`.github/dependabot.yml`](.github/dependabot.yml), which proposes grouped
weekly dependency pull requests.

> **One-time setup:** repo *Settings → Pages → Build and deployment → Source* must be set to
> **GitHub Actions** (not "Deploy from a branch"), or the workflow won't publish.

Preview the stripped build locally before pushing (any static server works for a finished
build; `serve-deck.py`'s no-cache server is only for live editing of the repo root):

```bash
python3 tools/strip-notes.py _site && (cd _site && python -m http.server 8000)
# then open http://localhost:8000/  — speaker notes (S) should be gone
```

**Custom domain.** The site is served at **`slides.frederickmadore.com`**. The [`CNAME`](CNAME)
file plus the matching *Settings → Pages → Custom domain* entry bind the subdomain to this Pages
deployment; the DNS record itself lives in Cloudflare. `fmadore.github.io/slides/` redirects here.

---

## Credits

reveal.js (MIT, © Hakim El Hattab) · highlight.js (BSD 3-Clause) ·
**EB Garamond** (Georg Duffner & Octavio Pardo) and **Libre Franklin**
(Pablo Impallari / Impallari Type), SIL OFL · GitHub & ORCID marks © their
owners · logo and palette: Africa Multiple Cluster of Excellence / University
of Bayreuth. Full licence texts: [`LICENSE.md`](LICENSE.md) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md); vendored versions and
checksums: [`shared/vendor-manifest.json`](shared/vendor-manifest.json).
