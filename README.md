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

The full design brief and rationale — including the earlier serif-led *editorial-archive*
iteration this theme grew out of — live in [`.impeccable.md`](.impeccable.md).

---

## Structure

```
slides/
├── index.html            ← landing page (GENERATED from talks/talks.json)
├── shared/               ← the reusable ENGINE, one copy shared by every talk
│   ├── theme.css deck.js     the “Broadsheet” theme + nav / chrome / TOC script
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
│   ├── export-pdf.mjs        per-deck slides.pdf + social-card.png (CI)
│   ├── check-links.py        external links in published decks (weekly, not CI)
│   ├── strip-notes.py        allowlisted, notes-free publication build (+ tests)
│   └── fetch-highlight.py    regenerate the slim highlight.js bundle
├── serve-deck.py             ← no-cache dev server (serves the whole repo)
├── .github/workflows/        pages.yml — validate, build and deploy
│                             link-check.yml — weekly link rot check
└── .nojekyll  CNAME  404.html  robots.txt  sitemap.xml  LICENSE.md
    THIRD_PARTY_NOTICES.md  .impeccable.md  README.md
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
(needs `pip install "qrcode[pil]"` once — everything else works without it).
Then edit the slides; the full layout catalogue with copy-paste examples lives
in `talks/_showcase/` (preview at `/talks/_showcase/`).

Doing it by hand instead: copy `talks/_template`, edit `DECK_CONFIG` + slides,
add an entry to `talks/talks.json` and run `python3 tools/build-index.py`.

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
margins None, background graphics on).

**Check slides fit:** open a talk with `?check` appended. Overflowing slides are
outlined in red with a banner, and the banner also shows the auto-fit scale the
engine applied to a dense slide (green ≥ 0.95, amber below, red below 0.90 —
a red slide fails validation unless you accept it explicitly with a
`data-fit-allow` attribute on its `<section>`). Add `?no-fit` (or use `?audit`)
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

**Customise the look:** all design tokens are at the top of `shared/theme.css` (`:root`) —
the six Bayreuth colours, the EB Garamond / Libre Franklin type, spacing. Change a font there, then
re-run `shared/fonts/fetch-fonts.py` to re-vendor it for offline use.

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
On every pull request and push it first **validates**: the unit tests for
`strip-notes.py` and `audit.py`, then `tools/audit.py` itself (repo and built
site, strict) — dead local references, duplicate ids, missing `alt`/`title`,
stale placeholders, the landing-page/manifest sync check and the **vendored
checksums** in [`shared/vendor-manifest.json`](shared/vendor-manifest.json) —
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
python3 tools/audit.py            # static checks (add --strict in CI mode)
node tools/browser-check.mjs      # needs playwright + a chromium
python3 tools/test_strip_notes.py # publication-build unit tests
python3 tools/test_audit.py       # one test per audit rule
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

Action versions are kept current by
[`.github/dependabot.yml`](.github/dependabot.yml), which proposes one grouped
pull request a week when any `actions/*` release lands.

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
