# Completed repository review — 9 September 2026

All twelve actionable audit findings were implemented: safe publication and note removal; print layout and media readiness; iframe fallback lifecycle; lazy gallery loading; both print URLs; reduced motion; escaped metadata; browser/visual validation; export cache freshness; evidence-slide readability; and documentation/skill drift. The completed issue-by-issue audit was removed to avoid retaining an obsolete backlog.

The repository also gained reader links, slide-link copying, rehearsal pacing, offline preflight and export evidence. README and DESIGN document their current contracts. The corresponding personal skill is maintained in the `slides/` directory of `fmadore/claude-skills`.

Validation passed: 124 Python tests, 14 Node tests, strict source/publication audits with zero findings, and eight decks at three viewports. Six public PDFs contain 120 pages; geometry and independent page counts passed, and all pages were rendered for contact-sheet review. Affected print pages were inspected at full size. An unchanged export reused its cache successfully.

The browser environment blocked external network access, so the ten live frames exported labelled placeholders. Local fallback behavior and simulated origin/source-checked readiness messages passed; live remote rendering remains environment-dependent. Use `--refresh-frames` for a network-enabled export. QR images are inventoried by preflight, not decoded; timing estimates do not replace rehearsal.
