#!/usr/bin/env python3
"""One-shot asset re-encode, driven by the measurements in issue #7.

Two rules, both derived from measured render sizes (tools measured every
<img> in the screen and print views of every published deck):

  size   an image ships at most 3x the largest box any deck renders it in
         (3x = a 4K projector showing the 1280px-wide slide area), and a
         lightbox-zoomable ".shot" ships at most 1800px on its long edge
         (the lightbox tops out at 92vw)
  format photographs ship as JPEG, because Chrome's print-to-PDF passes
         JPEG through byte-for-byte and re-encodes everything else into
         zlib'd RGB -- which is why 1.2 MB of WebP became 10.1 MB of PDF
"""
import os, sys, io
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = "--apply" not in sys.argv

# path, target (w,h) or None to keep, mode
#   jpg      photographic, 4:2:0
#   jpg-fine photographic with fine text (screenshots, scans), 4:4:4
#   jpg-gray greyscale source
#   pal<N>   flat-colour graphic -> N-colour palette PNG
PLAN = [
    # -- shared marks: rendered at 24-260px, shipped at 1280-1920 ---------
    ("shared/logo-africamultiple.png",       (780, 192), "pal64"),
    ("shared/logo-kcl.png",                  (96, 73),   "pal64"),
    ("shared/assets/logo-mcp.png",           (96, 96),   "pal64"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/logo-zmo.png", (144, 132), "pal64"),

    # -- QR codes: two colours shipped as 32-bit RGBA ---------------------
    ("talks/2026-05-06-dga-dormant-collections/assets/notebooklm-qr.png", None, "pal2"),
    ("talks/2026-06-15-luxembourg-beyond-keywords/assets/iwac-qr.png",    None, "pal2"),
    ("talks/2026-06-15-luxembourg-beyond-keywords/assets/qr-slides.png",  None, "pal2"),
    ("talks/2026-07-01-rhodes-reconfiguring-archive/assets/qr-amira.png", None, "pal2"),

    # -- WebP photographs -> JPEG ----------------------------------------
    ("talks/2026-05-06-dga-dormant-collections/assets/book-campuses.webp",    (331, 492), "jpg"),
    ("talks/2026-05-06-dga-dormant-collections/assets/book-religiosity.webp", (342, 492), "jpg"),
    ("talks/2026-05-06-dga-dormant-collections/assets/dh-bielefeld-hero.webp",(492, 492), "jpg-fine"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/clip-daho-express-1972.webp", None, "jpg-gray"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/clip-togo-presse-1963.webp",  None, "jpg-gray"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/clip-togo-presse-1971.webp",  None, "jpg-fine"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/montage-both-collections.webp", None, "jpg"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/ner-validator.webp", (1800, 1030), "jpg-fine"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/ocr-newspaper.webp", None, "jpg-fine"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/osh-kaaba-print.webp",      None, "jpg"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/osh-manuscript-open.webp",  None, "jpg"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/osh-manuscript-page.webp",  None, "jpg"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/osh-manuscript-stack.webp", None, "jpg"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/togo-bichkek-akipress.webp",       None, "jpg-fine"),
    ("talks/2026-06-29-erlangen-islam-peripheries/assets/togo-bichkek-republicoftogo.webp", None, "jpg-fine"),

    # -- zoomables above the 1800px lightbox ceiling ----------------------
    # (wisski-1.png is 1918px: 6% over, and a PNG re-encode gains nothing)
    ("shared/assets/glam-e-lab.jpg",                                  (1800, 851),  "jpg-fine"),
    ("talks/2026-06-15-luxembourg-beyond-keywords/assets/iwac-home.jpg",   (1800, 977),  "jpg-fine"),
    ("talks/2026-06-15-luxembourg-beyond-keywords/assets/iwac-search.jpg", (1800, 1018), "jpg-fine"),
]

QUALITY = {"jpg": 85, "jpg-fine": 85, "jpg-gray": 85}


def encode(src_path, target, mode):
    im = Image.open(src_path)
    im.load()
    if target and tuple(target) != im.size:
        im = im.convert("RGBA" if mode.startswith(("pal", "png")) else "RGB")
        im = im.resize(tuple(target), Image.LANCZOS)
    buf = io.BytesIO()
    if mode.startswith("pal"):
        n = int(mode[3:])
        out = im.convert("RGBA").quantize(colors=n, method=Image.FASTOCTREE)
        out.save(buf, "PNG", optimize=True)
        ext = ".png"
    elif mode == "png":
        im.convert("RGBA").save(buf, "PNG", optimize=True)
        ext = ".png"
    else:
        out = im.convert("L" if mode == "jpg-gray" else "RGB")
        out.save(buf, "JPEG", quality=QUALITY[mode], optimize=True, progressive=True,
                 subsampling=0 if mode != "jpg" else 2)
        ext = ".jpg"
    return buf.getvalue(), ext, im.size


before = after = 0
renames = []
for rel, target, mode in PLAN:
    src = os.path.join(REPO, rel)
    old_size = os.path.getsize(src)
    old_dims = Image.open(src).size
    data, ext, new_dims = encode(src, target, mode)
    dst_rel = os.path.splitext(rel)[0] + ext
    before += old_size
    after += len(data)
    flag = "" if len(data) < old_size else "  <-- BIGGER"
    print(f"{old_size/1024:8.1f} -> {len(data)/1024:7.1f} KB  "
          f"{old_dims[0]}x{old_dims[1]} -> {new_dims[0]}x{new_dims[1]}  {mode:9} "
          f"{os.path.basename(rel)}{flag}")
    if DRY:
        continue
    with open(os.path.join(REPO, dst_rel), "wb") as fh:
        fh.write(data)
    if dst_rel != rel:
        os.remove(src)
        renames.append((rel, dst_rel))

print(f"\ntotal {before/1024/1024:.2f} MB -> {after/1024/1024:.2f} MB "
      f"({100 * (before - after) / before:.0f}% lighter)")
if renames:
    print("\nrenamed:")
    for a, b in renames:
        print(f"  {a} -> {b}")
if DRY:
    print("\n(dry run — pass --apply to write)")
