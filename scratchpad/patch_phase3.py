import io, sys

def sub(path, old, new, count=1):
    with io.open(path, encoding='utf-8', newline='') as f:
        s = f.read()
    if s.count(old) != count:
        sys.exit("PATCH FAIL in %s: found %d of expected %d\n---\n%s" % (path, s.count(old), count, old[:400]))
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(s.replace(old, new, count))
    print("patched", path)

THEME = 'shared/src/theme/05-embeds-code.css'

# 1 — the Sunken inset loses its hairline, as .reveal pre did in Pass 5,
#     and becomes the containing block for the paper-cut marks below.
sub(THEME,
"""/* Scrollable file embed — e.g. the live SKILL.md; the presenter scrolls it. */
.reveal .scroll-panel {
  flex: 1 1 auto; min-height: 0; max-height: 25rem; width: 100%; overflow-y: auto; overscroll-behavior: contain;
  background: var(--sunken); border: 1px solid var(--line); border-radius: var(--radius-md);""",
"""/* Scrollable file embed — e.g. the live SKILL.md; the presenter scrolls it.
   No hairline: this is the Sunken inset, whose surface is the fill plus the
   inset shadow and never either one with an outline on top. `.reveal pre` was
   brought under that rule in Pass 5; its scrollable sibling was missed. */
.reveal .scroll-panel {
  position: relative;   /* containing block for the paper-cut marks */
  flex: 1 1 auto; min-height: 0; max-height: 25rem; width: 100%; overflow-y: auto; overscroll-behavior: contain;
  background: var(--sunken); border: none; border-radius: var(--radius-md);""")

# 2 — the paper cut: on screen the panel scrolls, on paper it cannot, so the
#     truncation is drawn rather than left silent, and the instruction goes.
sub(THEME,
"""/* ----------------------------------------------------------------------------
   9. FRAGMENTS & TRANSITIONS
   ---------------------------------------------------------------------------- */""",
"""/* THE PAPER CUT. A scroll panel cannot scroll on paper, and under the
   one-page-per-slide contract a 190-line file was never going to fit a
   1280×720 page — so the excerpt is unavoidable. What was avoidable is the
   silence: the PDF used to hard-cut mid-sentence with no mark at all, under
   authored copy still telling the reader to scroll. The cut is now drawn in
   the theme's own vocabulary — the text fades into the Sunken fill, the heavy
   near-black rule that opens a block is used here to close one, and a gothic
   label names what the reader is holding. Both marks and the suppressed hint
   hang off the same pair of properties, declared once per paper context. */
.reveal .scroll-panel::after,
.reveal .scroll-panel::before {
  display: var(--excerpt-mark, none);
  position: absolute; left: 0; right: 0; pointer-events: none;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.reveal .scroll-panel::after {           /* the fade, seated on the band */
  content: ""; bottom: 2.05em; height: 3.6em;
  background: linear-gradient(to bottom, transparent, var(--sunken));
}
.reveal .scroll-panel::before {          /* the band that closes the panel */
  content: "Excerpt"; bottom: 0; padding: 0.4em 1.5em;
  background: var(--sunken); border-top: 2px solid var(--rule);
  font-family: var(--font-label); font-size: var(--fs-footer); font-weight: 700;
  letter-spacing: var(--track-label); text-transform: uppercase; color: var(--ink-soft);
}
html[lang="fr"] .reveal .scroll-panel::before { content: "Extrait"; }
.reveal .scroll-hint { display: var(--scroll-hint-display, inline-flex); }
/* The two paper contexts: the real print run, and the ?print-pdf preview the
   author actually looks at. Same pair of declarations, same reason. */
@media print { .reveal { --excerpt-mark: block; --scroll-hint-display: none; } }
html.reveal-print .reveal { --excerpt-mark: block; --scroll-hint-display: none; }

/* ----------------------------------------------------------------------------
   9. FRAGMENTS & TRANSITIONS
   ---------------------------------------------------------------------------- */""")

# --------------------------------------------------------------- per-deck ---
LUX = 'talks/2026-06-15-luxembourg-beyond-keywords/index.html'
DGA = 'talks/2026-05-06-dga-dormant-collections/index.html'

# luxembourg: transition: all fades the focus ring up on a real control
sub(LUX,
"""      background: transparent; color: var(--ink-soft); border: 1.5px solid var(--line-strong); transition: all var(--dur) var(--ease); }""",
"""      background: transparent; color: var(--ink-soft); border: 1.5px solid var(--line-strong);
      /* Never `all`: it sweeps outline-color and outline-offset in too, so the
         focus ring faded up over 220ms instead of landing with focus. */
      transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease); }""")

# luxembourg: the demo tag was the smallest type in the archive (9.9px)
sub(LUX,
"""    .reveal .kvm-tag { font-family: var(--font-label); font-weight: 700; font-size: 0.62rem; letter-spacing: 0.05em;""",
"""    .reveal .kvm-tag { font-family: var(--font-label); font-weight: 700; font-size: var(--fs-caption); letter-spacing: 0.05em;""")

# dga: the Sunken inset with a hairline outline — the retired card pattern
sub(DGA,
"""    .reveal .extract { background: var(--sunken); border: var(--hair); border-radius: var(--radius-md);
      padding: var(--space-md) var(--space-lg); }""",
"""    .reveal .extract { background: var(--sunken); border: none; border-radius: var(--radius-md);
      padding: var(--space-md) var(--space-lg); }""")

# dga: the book-cover caption sat below even the chrome floor (11.8px)
sub(DGA,
"""    .reveal .bio-gallery figcaption { font-family: var(--font-label); font-size: 0.74rem;""",
"""    .reveal .bio-gallery figcaption { font-family: var(--font-label); font-size: var(--fs-caption);""")
