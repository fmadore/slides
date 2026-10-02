# Repository review implementation — 2 October 2026

Base: `8a89125a40cea6bdd4b27e8d09d7545aeb5e4b91`.

## Changes

- Updated reveal.js to 6.0.2 with verified upstream archive integrity and
  file hashes. Added reproducible vendoring and a separate freshness monitor.
- Repaired resize fitting, wrapped-image galleries, touch interaction with
  the contents dialog, footer link hit testing and iframe fallback readiness.
  A framing permission declaration no longer hides an offline screenshot.
- Made export orchestration testable and transactional. Failed HTTP, blank,
  stalled or offline captures stay retryable; evidence records status, final
  URL and capture mode. Saved local images survive failed live captures.
  Image readiness checks also cover deliberately clipped containers.
- Scoped publication exclusions, audited references in the actual artifact,
  rejected symlink inputs and limited cached extras to current decks.
  Highlight regeneration validates first and retains recovery bytes if a
  failed replacement cannot be rolled back.
- Split the Python audit into focused modules while keeping its public CLI.
  Added strict manifest and selector validation, accurate note/leaf-slide
  accounting, explicit preflight readiness categories and real QR decoding.
- Added generated reading editions for all seven talks: semantic headings,
  mobile reflow, 200% text support, figures, transcripts and source links.
  Notes and scripts are excluded. Catalogue entries show slide counts, share
  an AI/IA topic and support optional authored duration estimates.
- Added deterministic, notes-free offline rehearsal ZIPs with shared assets,
  saved views and a loopback server. PDFs absent from the source bundle link
  to the public site and require a network connection.
- Shortened the Rhodes cluster lead to remove its fit exception. Replaced
  dense Stellenbosch screenshot-only summaries with readable native evidence
  and explicit interpretive limits, preserving complete zoomable sources.
  Added reusable archival source/transcription and evidence layouts.
- Pinned Actions to verified commits, scoped write permissions to deployment,
  enforced main-only deploys, and added built-site/download checks. Expanded
  visual coverage and retained screenshots/traces on failure. Intentional
  visual approvals bind to exact image hashes and the merge base. Firefox and
  WebKit smoke jobs gate the publication build.

## Local verification

| Check | Result |
| --- | --- |
| Python unit/integration tests | 211 passed, including actual scaffold and QR decode |
| Node unit tests | 25 passed |
| Generated bundles, metadata, catalogue, readers | In sync |
| Source and publication strict audits | 0 errors, 0 warnings |
| Source browser checks | All 9 decks at 1280×720, 844×390 and 390×844 passed |
| Accessibility | No automated WCAG A/AA findings in decks, readers, contents, landing or 404 |
| Reader checks | All 7 passed offline/no-script, 390px, 200% text, figures and anchors |
| Runtime interaction regressions | Resize, touch, galleries, focus, fallback lifecycle passed |
| Export browser regressions | 9 real-browser fixture groups passed |
| Full publication exports | 7 PDFs, 123 pages; geometry and page counts passed |
| Built-site smoke | All 7 decks, readers, notes removal and PDF/card downloads passed |
| Visual comparison | 34 images reviewed; 12 expected portrait changes explicitly approved |
| PDF appearance | Rhodes 2, Stellenbosch 12/14 and Kansas fallback pages inspected |
| Offline rehearsal | Selected-deck ZIP built and its references checked |

Local browser: Chromium 153.0.8010.0. Node 24.19.0, Python 3.12.14.
CI uses its pinned Playwright browser and Node 22.

## Verification limits

External sites were unreachable during export. The final run used a 2-second
capture timeout and correctly produced five authored saved views and nine
labelled placeholders; it does not establish live-site readiness. Normal CI
retains the default 12-second timeout and retries failed capture evidence.
The existing Kansas sentiment screenshot shows the dashboard controls rather
than its lower charts; it remains an honest saved view, not a fresh capture.

Firefox initialization stalled in the local container and WebKit lacked host
libraries. The host denied package installation. Those engines require the
Ubuntu CI jobs before their checks can be reported as passed. Exact visual
approvals may require reinspection if CI's browser renders different pixels.
Automated accessibility and geometry checks complement visual review and
actual rehearsal; they do not replace either.
