Parked from the Impeccable roadmap (Phase 2, `distill`), now closed out. Each
claim below was re-verified 2026-08-20 rather than carried over on trust.

**Defined in the theme, used by no deck:**
- `.chrome-open` (`08-image-editorial.css:38`) — zero occurrences across all
  seven decks.
- `.panel.sunken` (`03-layouts.css:175`) — zero deck occurrences. Note this one
  is load-bearing *as documentation*: DESIGN.md names the Sunken inset as the
  system's single sanctioned surface, and `.reveal pre` and `.scroll-panel` were
  both brought back under that rule by pointing at it. Deleting the class would
  cost the rule its reference implementation.
- `.no-draw` — the motion opt-out. It works (Pass 6 gave it one switch covering
  all six signature animations), and `talks/_showcase` documents it in a comment
  at line 57, but no deck actually applies it.

**The duplicated frame family:** `.chrome` and `.site-frame` do closely related
jobs — a true-colour screenshot in browser chrome, and a live iframe in browser
chrome. `.chrome` appears only in `talks/_showcase`; all five published decks
use `.site-frame`. DESIGN.md's Shadow Vocabulary names only `.chrome` as the
`shadow-2` case, while four selectors in the theme actually take it.

The question `distill` should answer is whether these are dead weight or a
deliberately stocked vocabulary — the catalogue exists precisely to demonstrate
components before a talk needs them, so "unused" is not automatically "delete".
