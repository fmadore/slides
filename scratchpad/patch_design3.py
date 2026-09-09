import io, sys, json

def sub(path, old, new):
    with io.open(path, encoding='utf-8', newline='') as f:
        s = f.read()
    if s.count(old) != 1:
        sys.exit("FAIL in %s: %d matches for %r" % (path, s.count(old), old[:120]))
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(s.replace(old, new, 1))
    print("patched", path)

D = 'DESIGN.md'

# The Sunken rule gains its third surface.
sub(D,
"""A block that wants a boundary takes the opening rule or the Sunken fill, never a hairline outline on top of either.""",
"""A block that wants a boundary takes the opening rule or the Sunken fill, never a hairline outline on top of either. The **scrollable file embed (`.scroll-panel`)** was the same construction a third time — Sunken fill, 1px `Line` border, `--radius-md` — and it survived that pass because only the code block was looked at. It is now borderless too: the fill and the inset shadow are the surface. A scroll container does not earn an outline for marking where the scrolling stops; the inset shadow already says that.""")

# A new Named Rule for print honesty.
sub(D,
"""**The Scrim Guarantee Rule.**""",
"""**The Paper Cannot Scroll Rule.** An affordance that only exists on screen must be answered in print, not left to fail quietly. `.scroll-panel` caps at 25rem and scrolls; on paper it cannot, and under the one-page-per-slide contract a 190-line file was never going to fit a 1280×720 page — so the excerpt is unavoidable and only the silence was ever the defect. The PDF used to hard-cut mid-sentence with no mark, beneath authored copy still telling the reader to scroll. Print now draws the cut in the system's own vocabulary: the text fades into the Sunken fill, the heavy near-black rule that opens a block is used here to close one, and a gothic `Excerpt` band names what the reader is holding — `Extrait` under `html[lang="fr"]`. A panel carrying `data-source-url` prints the address beside the label, in its own case and eased tracking, because uppercasing a URL shouts it; that attribute already existed as deck.js's load-failure fallback, so the band reuses the author's answer rather than asking for a second one, and it is what keeps the suppressed `.scroll-hint` from taking a URL down with it. Both marks and the suppressed hint hang off `--excerpt-mark` / `--scroll-hint-display`, declared once for `@media print` and once for the `?print-pdf` preview.

**The Scrim Guarantee Rule.**""")

# Do / Don't
sub(D,
"""- **Don't** put a border on the Sunken inset (code blocks included) or a radius on a ruled column; the surface is either the fill or the opening rule, never either one plus a hairline outline.""",
"""- **Don't** put a border on the Sunken inset (code blocks and the scroll panel included) or a radius on a ruled column; the surface is either the fill or the opening rule, never either one plus a hairline outline.
- **Don't** let a screen-only affordance fail silently on paper: give the scroll panel a `data-source-url` so its printed `Excerpt` band names the source, and never leave an instruction in print that the reader cannot follow.""")

# sidecar: record the two switches next to the motion ones
p = '.impeccable/design.json'
d = json.load(io.open(p, encoding='utf-8'))
ext = d['extensions']
ext['print'] = [
    {"name": "excerpt-mark", "value": "none | block",
     "purpose": "Draws the paper cut on .scroll-panel: a fade into the Sunken fill plus a ruled Excerpt band (Extrait under html[lang=fr]; the address appended when the panel carries data-source-url). Set to block by @media print and by html.reveal-print for the ?print-pdf preview."},
    {"name": "scroll-hint-display", "value": "inline-flex | none",
     "purpose": "Suppresses the on-screen scroll instruction in print, where it would be a false one. Declared alongside --excerpt-mark in the same two paper contexts."},
]
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
print("patched", p)
