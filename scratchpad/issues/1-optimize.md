Parked from the Impeccable roadmap (Phase 2, `optimize`), now closed out. Two
concrete measurements, both taken 2026-08-20:

**The footer logo is a 22× oversample on every slide.**
`shared/logo-africamultiple.png` is 1655×407 and 135 KB. It renders at **75×18**
in the deck footer — on every slide of every deck, and in every exported PDF
page. An SVG (as `logo-bayreuth.svg` already is, at 6 KB) or a correctly sized
raster would drop it by well over an order of magnitude.

**The exported PDFs are heavy.**

| deck | pages | size |
|---|---|---|
| erlangen-islam-peripheries | 24 | **11.3 MB** |
| dga-dormant-collections | 17 | 6.5 MB |
| luxembourg-beyond-keywords | 19 | 2.7 MB |
| rhodes-reconfiguring-archive | 18 | 1.8 MB |
| paris-reaf-dh-ia-afrique | 17 | 0.9 MB |

These are citable research outputs people download, so weight is a product
concern rather than a housekeeping one. Worth checking whether the source
images are being embedded at their full natural size the way the logo is.

Scope note: this is `optimize` in the Impeccable sense — measure first, then fix
what the measurement justifies. It is not a licence to re-encode the archive.
