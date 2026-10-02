"""Path-aware asset hygiene and lightweight image metadata inspection."""
import hashlib
import os
import re
from .html_refs import DeckParser, css_references, is_local, is_within, local_path, PRUNED_DIRS

TEXT_EXT = {".html", ".css", ".js", ".mjs", ".json", ".md", ".svg", ".txt", ".py", ".yml"}
MARKDOWN_REF_RE = re.compile(r"!?\[[^\]]*\]\(\s*(?P<url>[^\s)]+)")
QUOTED_ASSET_RE = re.compile(
    r"(?P<q>['\"])(?P<url>[^'\"\n]+\.(?:png|jpe?g|webp|svg|woff2?|md|pdf|css|m?js))(?P=q)",
    re.IGNORECASE,
)

def file_digest(path, algorithm="md5"):
    h = hashlib.new(algorithm)
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def reference_targets(root):
    """Resolve local references to exact files, avoiding basename collisions."""
    targets = set()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in PRUNED_DIRS]
        for name in filenames:
            path = os.path.join(dirpath, name)
            ext = os.path.splitext(name)[1].lower()
            if ext not in TEXT_EXT:
                continue
            try:
                with open(path, encoding="utf-8") as handle:
                    source = handle.read()
            except UnicodeDecodeError:
                continue
            urls = []
            if ext == ".html":
                parser = DeckParser()
                parser.feed(source)
                urls.extend(url for _, url in parser.refs)
                urls.extend(css_references(source))  # inline style blocks/attributes
            elif ext == ".css" and not os.path.relpath(path, root).startswith(
                    os.path.join("shared", "src") + os.sep):
                urls.extend(css_references(source))
            elif ext == ".md":
                urls.extend(match.group("url") for match in MARKDOWN_REF_RE.finditer(source))
            elif ext in {".js", ".mjs", ".json"}:
                urls.extend(match.group("url") for match in QUOTED_ASSET_RE.finditer(source))
            for url in urls:
                if not is_local(url):
                    continue
                target = local_path(dirpath, url, root=root)
                if target and is_within(target, root):
                    targets.add(os.path.normcase(os.path.abspath(target)))
    return targets


# --- image weight -----------------------------------------------------------
# Both ceilings come from measuring what the decks actually display (issue #7).
#
# A raster wider than PIXEL_CEILING cannot be shown at full resolution: the
# slide area is 1280 CSS px and the lightbox tops out at 92vw, so 1800px covers
# a zoomed screenshot on a 1920-wide screen with nothing to spare.
#
# WebP is rejected outright, and not for browser support. Chrome's print-to-PDF
# passes a JPEG through byte-for-byte but has no WebP filter to pass through
# to, so it decodes every WebP and re-emits it as zlib'd RGB. Measured on the
# Erlangen deck: 1.2 MB of WebP sources became 10.1 MB of PDF images. The same
# pictures as JPEG cost 1.7 MB.
PIXEL_CEILING = 1800
BYTE_CEILING = 600 * 1024
RASTER_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def image_size(path):
    """(width, height) of a PNG/JPEG/GIF/WebP, or None. Header parsing only."""
    with open(path, "rb") as fh:
        head = fh.read(32)
        if head[:8] == b"\x89PNG\r\n\x1a\n" and head[12:16] == b"IHDR":
            return int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")
        if head[:6] in (b"GIF87a", b"GIF89a"):
            return int.from_bytes(head[6:8], "little"), int.from_bytes(head[8:10], "little")
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            chunk = head[12:16]
            if chunk == b"VP8X":
                return (int.from_bytes(head[24:27], "little") + 1,
                        int.from_bytes(head[27:30], "little") + 1)
            if chunk == b"VP8 ":
                return (int.from_bytes(head[26:28], "little") & 0x3FFF,
                        int.from_bytes(head[28:30], "little") & 0x3FFF)
            if chunk == b"VP8L":
                bits = int.from_bytes(head[21:25], "little")
                return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            return None
        if head[:2] != b"\xff\xd8":
            return None
        fh.seek(2)
        while True:
            marker = fh.read(2)
            if len(marker) < 2 or marker[0] != 0xFF:
                return None
            length = int.from_bytes(fh.read(2), "big")
            # SOF0-SOF15, minus the four markers in that range that are not
            # frame headers (DHT, JPG, DAC, and the standalone SOI).
            if 0xC0 <= marker[1] <= 0xCF and marker[1] not in (0xC4, 0xC8, 0xCC, 0xD8):
                fh.read(1)                                  # sample precision
                height = int.from_bytes(fh.read(2), "big")
                width = int.from_bytes(fh.read(2), "big")
                return width, height
            fh.seek(length - 2, os.SEEK_CUR)


def audit_image_weight(rep, root):
    """Shipped rasters stay inside the size and format budget (warnings)."""
    roots = [os.path.join(root, "shared")]
    roots += [os.path.join(root, "talks", slug) for slug in sorted(os.listdir(os.path.join(root, "talks")))
              if os.path.isdir(os.path.join(root, "talks", slug)) and not slug.startswith("_")]
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            for name in sorted(filenames):
                ext = os.path.splitext(name)[1].lower()
                if ext not in RASTER_EXT:
                    continue
                path = os.path.join(dirpath, name)
                rel = os.path.relpath(path, root)
                if ext == ".webp":
                    rep.warn(rel, "WebP ships to the PDF export as zlib'd RGB, roughly "
                                  "10x its own weight — use JPEG for photographs, PNG for flat art")
                    continue
                size = image_size(path)
                if size and max(size) > PIXEL_CEILING:
                    rep.warn(rel, f"{size[0]}x{size[1]}: nothing can display more than "
                                  f"{PIXEL_CEILING}px (slide area is 1280px, lightbox 92vw)")
                weight = os.path.getsize(path)
                if weight > BYTE_CEILING:
                    rep.warn(rel, f"{weight / 1024:.0f} KB in a deck people download as a PDF "
                                  f"(ceiling {BYTE_CEILING // 1024} KB)")


def audit_assets(rep, root):
    """Path-aware orphan detection and exact duplicate files (warnings)."""
    referenced = reference_targets(root)

    hashes = {}
    for sub in ("talks", "shared"):
        for dirpath, dirnames, filenames in os.walk(os.path.join(root, sub)):
            for n in filenames:
                path = os.path.join(dirpath, n)
                rel = os.path.relpath(path, root)
                ext = os.path.splitext(n)[1]
                if n in {".gitkeep", "talks.json", "vendor-manifest.json"} or ext in {".html", ".py"}:
                    continue
                if rel.startswith(os.path.join("shared", "src") + os.sep):
                    continue  # build-shared.mjs accounts for every source partial
                if os.path.normcase(os.path.abspath(path)) not in referenced:
                    rep.warn(rel, "asset has no path-resolved reference (orphan?)")
                if ext in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".md", ".pdf"}:
                    hashes.setdefault(file_digest(path), []).append(rel)
    for digest, paths in sorted(hashes.items()):
        if len(paths) > 1:
            # the starter and the showcase legitimately share placeholder assets
            if all(p.split(os.sep)[1].startswith("_") for p in paths
                   if p.startswith("talks" + os.sep)) and \
               all(p.startswith("talks" + os.sep) for p in paths):
                continue
            rep.warn(paths[0], "exact duplicate files: " + " = ".join(paths)
                     + " (move one copy to shared/assets/)")

