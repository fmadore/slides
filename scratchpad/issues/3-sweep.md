Phase 3 of the Impeccable roadmap swept the five published decks by hand-rolling
a linter over their per-deck `<style>` blocks and inline styles, checking them
against the rules the six Phase 2 passes established. It found four real
defects that the shared theme could not reach, because **per-deck CSS inherits
nothing**: a `transition: all` that faded a focus ring up over 220ms, a retired
card pattern, and two type sizes below the theme's own chrome floor.

That class of drift will recur every time a deck adds local CSS, and nothing in
CI currently looks for it. The checks are small and mechanical:

- viewport units or `clamp()` inside `.reveal .slides` (the Fixed Canvas Rule)
- `transition: all` (sweeps `outline-color`/`outline-offset`, so the focus ring
  animates)
- `box-shadow` on in-flow slide content (the Overlay-Only Shadow Rule)
- a hairline border plus a radius (the card shape the system retired)
- `font-size` below the in-canvas floor
- raw corporate hex where a token exists
- hand-patched hero centring the theme now owns at `.present`
- an `animation` that does not read `var(--draw-run)`, so no stiller reaches it

`tools/audit.py` is the natural home. Two warnings from writing it the first
time, both worth encoding as tests:

1. The rule parser never reset its brace depth, so it read **one** rule out of a
   128-line stylesheet and reported the archives clean. Any such check needs a
   known-bad fixture proving each rule fires.
2. A contrast probe that round-trips colours through canvas `fillStyle` does
   **not** resolve `oklch()` — it silently reads the OKLCH components as RGB and
   invents failures. Paint the colour and read the pixel back instead.

Contrast checks specifically must also respect WCAG large-text thresholds: two
"failures" in the sweep were `--green` at 24px/700, which measures 3.87:1
against a 3:1 requirement and passes.
