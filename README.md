# Slides — Frédérick Madore

Talk slides on Islam in West Africa, digital humanities, and the **Islam West Africa
Collection (IWAC)**. Built as offline-capable [reveal.js](https://revealjs.com) decks with a
shared, editorial theme using the Africa Multiple Cluster of Excellence logo and the
University of Bayreuth colour palette.

**Live:** https://fmadore.github.io/slides/ — a custom subdomain is planned ([ROADMAP](ROADMAP.md)).

---

## Structure

```
slides/
├── index.html        ← landing page (lists talks — edit the TALKS array)
├── shared/           ← the reusable ENGINE, one copy for every talk
│   ├── theme.css  deck.js
│   ├── logo-africamultiple.png  logo-bayreuth.webp
│   ├── fonts/        self-hosted Literata + Hanken Grotesk (offline)
│   └── reveal/       vendored reveal.js v6 + plugins (offline)
├── talks/
│   ├── _template/    ← copy this to start a new talk
│   └── 2026-06-15-luxembourg-beyond-keywords/
│       ├── index.html        (slides + config; points to ../../shared)
│       └── assets/           (this talk's images / embedded files)
├── serve-deck.py     ← no-cache dev server (serves the whole repo)
├── .nojekyll  CNAME  README.md
```

Each talk references the one shared engine via `../../shared/…`, so a fix to `theme.css`
or `deck.js` updates **every** talk. Paths are relative, so the site works both at
`slides.frederickmadore.com` and at `fmadore.github.io/slides/`.

---

## Add a new talk

1. **Copy the starter:** `talks/_template` → `talks/YYYY-MM-DD-place-short-title`.
2. Edit the **`DECK_CONFIG`** block (presenter, title, venue, links) and the slides.
3. Add one entry to the **`TALKS`** array in [`index.html`](index.html) (newest first):

```js
{ date: "2026-09-01", event: "Conference · City", title: "My talk",
  desc: "One-line description.", slug: "2026-09-01-city-my-talk" }
```

---

## Preview locally

Decks must be served over HTTP (not `file://`). From the repo root:

```bash
python serve-deck.py          # no-cache server → http://localhost:8742
```

Open `http://localhost:8742/` for the landing page, or a talk directly at
`/talks/<slug>/`. The no-cache server guarantees reloads always show your latest edits.
(For just viewing, any static server works, e.g. `python -m http.server`.)

---

## Using the deck

**Keyboard:** `←/→` navigate · `T` table of contents · `O` overview · `F` fullscreen ·
`S` speaker notes · `Esc` close overlays. On-screen ‹ › buttons and a **Contents** button
sit in the footer.

**Layouts** (see `talks/_template/index.html` for live examples): cover, section divider
(`.section`, `.section.green`), standard content, two-column (`.cols`, `.cols.ratio-3-2`),
big statement (`.statement`, `.statement.quote`), code (`<pre><code class="language-…">`),
full-bleed media (`.media`), closing (`.closing`). Helpers: `.kicker`, `.callout`
(`.warm`/`.navy`), `.stat`, `.chip`, `.panel`, `.balance` (vertically centre a sparse
slide), `data-toc="…"` to add a slide to the table of contents, `<aside class="notes">`
(or a Markdown `Note:` line) for speaker notes.

**Write slides in Markdown.** Most slides can be authored as Markdown instead of HTML —
wrap the body in `<section data-markdown><textarea data-template> … </textarea></section>`.
The template uses this for the cover, section divider, standard content, statement and
closing; richer layouts (two-column, panels, code, media, the scroll-panel) stay as plain
HTML, and the two mix freely in one deck. Conventions:

- **Slide-level attributes** (layout `class`, `data-toc`, `data-footer`) go on the
  `<section>` tag, exactly like an HTML slide.
- **Element classes** use a comment on the line *directly below* the element — put it on
  its own line so it binds even when the line contains links/emphasis/spans:

  ```markdown
  A lead line with a [link](…).
  <!-- .element: class="lead" -->
  ```
- **Speaker notes**: a line starting with `Note:` — everything after it becomes the note
  (handled by the speaker-notes plugin; press `S`).
- Keep the body indented consistently; the first content line sets the baseline indent the
  plugin strips, so leave blank lines truly empty.

The Markdown engine is the vendored reveal.js Markdown plugin
(`shared/reveal/plugin/markdown.js`, loaded before the others), so decks stay fully offline.

**Scrollable file embed** (e.g. a GitHub skill): a `<div class="scroll-panel"
data-skill-src="assets/file.md">` loads and syntax-highlights a vendored file you can
scroll on stage. GitHub pages can't be `<iframe>`d, so vendor the file (also keeps it
offline). Refresh the IWAC skill snapshot with:

```bash
curl -fsS "https://raw.githubusercontent.com/fmadore/iwac-mcp-server/main/.claude/skills/iwac-mcp/SKILL.md" \
  -o talks/2026-06-15-luxembourg-beyond-keywords/assets/iwac-skill.md
```

**Framed live site** (e.g. a live website overview): a `<div class="site-frame">` gives a
browser-style chrome bar over a fitted viewport holding an `<iframe>`. Note two caveats — a
live frame needs a network connection (it isn't offline like the rest of the deck), and many
sites refuse to be framed (`X-Frame-Options` / CSP `frame-ancestors`); verify in a browser.
If a site blocks framing, drop a screenshot into the talk's `assets/` and swap the `<iframe>`
for an `<img>` (the same `.site-frame-view` styling fits both). See the "A live look" slide in
the Luxembourg deck for the markup.

**Export to PDF:** open a talk with `?print-pdf` appended, then print → Save as PDF
(Landscape, margins None, background graphics on).

**Customise the look:** all design tokens are at the top of `shared/theme.css` (`:root`) —
the six Bayreuth colours, the Literata/Hanken type, spacing. Change a font there, then
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

Deployed by the **GitHub Actions** workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml):
on every push to `main` it builds a copy of the site with **speaker notes stripped**
(`tools/strip-notes.py` removes `<aside class="notes">` and Markdown `Note:` blocks) and
publishes that — so the live site never exposes notes via the `S` speaker view or
view-source. Your repo keeps the notes; only the deployed copy is stripped. Live at
**https://fmadore.github.io/slides/**.

> **One-time setup:** repo *Settings → Pages → Build and deployment → Source* must be set to
> **GitHub Actions** (not "Deploy from a branch"), or the workflow won't publish.

Preview the stripped build locally before pushing (any static server works for a finished
build; `serve-deck.py`'s no-cache server is only for live editing of the repo root):

```bash
python3 tools/strip-notes.py _site && (cd _site && python -m http.server 8000)
# then open http://localhost:8000/  — speaker notes (S) should be gone
```

A custom subdomain (`slides.frederickmadore.com`) is planned but not set up yet; the steps
are in [ROADMAP.md](ROADMAP.md).

---

## Credits

reveal.js (MIT, © Hakim El Hattab) · **Literata** (Google/TypeTogether) and **Hanken
Grotesk** (Alfredo Marco Pradil), SIL OFL · GitHub & ORCID marks © their owners · logo and
palette: Africa Multiple Cluster of Excellence / University of Bayreuth.
