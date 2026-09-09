import io, sys

p = r'C:\Users\frede\.claude\skills\slides\SKILL.md'
raw = io.open(p, encoding='utf-8', newline='').read()
NL = '\r\n' if '\r\n' in raw else '\n'
s = raw

def sub(old, new):
    global s
    old = old.replace('\n', NL); new = new.replace('\n', NL)
    if s.count(old) != 1:
        sys.exit('FAIL: %d matches for %r' % (s.count(old), old[:70]))
    s = s.replace(old, new, 1)

# 1 — the theme's name. "editorial" is the retired direction; the shipped system
#     is Broadsheet, which the design-authority paragraph below already names.
sub("""shared Africa Multiple / University of Bayreuth editorial theme.""",
    """shared Africa Multiple / University of Bayreuth **Broadsheet** theme.""")

# 2 — fragments are now the scaffold default, and the motion has one opt-out
sub("""or running head — the engine injects them. One screen per slide (fixed 1280×720 canvas).""",
    """or running head — the engine injects them. One screen per slide (fixed 1280×720 canvas).
**Fragments:** `talks/_template` seeds a stepped list, so a scaffolded deck starts with
`class="fragment"` on its bullets — keep them when the room should be walked through the points,
delete them when the points need to be compared. The whole motion signature stills with
`class="no-draw"` on the `.reveal` div or on a single `<section>`; nothing else needs switching
off, and any new signature animation should take its duration from `var(--draw-run)` so the same
switch reaches it.""")

# 3 — the PDF-fidelity rule that came out of the Phase 3 sweep
sub("""affected PDF pages to PNG with Poppler, inspect them, and remove `tmp/pdfs/` afterwards. Treat""",
    """affected PDF pages to PNG with Poppler, inspect them, and remove `tmp/pdfs/` afterwards.
A `.scroll-panel` cannot scroll on paper: the PDF prints what fits and closes it with a ruled
"Excerpt" band, so give the panel a `data-source-url` and the band names where the full file lives
— the on-screen `.scroll-hint` is suppressed in print, and a URL that lives only there would be
lost. Treat""")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('slides skill updated (line ending: %s)' % repr(NL))
