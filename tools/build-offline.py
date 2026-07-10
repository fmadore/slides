#!/usr/bin/env python3
"""Build one self-contained offline ZIP per published talk.

Each talks/<slug>/offline.zip unpacks to a folder holding the deck at its
root (index.html), its assets/, everything it needs from shared/ (theme,
engine, fonts, vendored reveal.js, shared assets), a tiny `serve.py`
launcher and a README with local-server instructions. The deck's
../../shared/ references are rewritten to shared/ so the unpacked folder is
fully standalone — no network, no repository.

Run against the publication build so the bundles are notes-free:
  python3 tools/strip-notes.py _site
  python3 tools/build-offline.py --root _site

Usage:
  python3 tools/build-offline.py [--root DIR] [--decks slug1,slug2]
"""
import argparse
import os
import sys
import zipfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

README = """OFFLINE COPY — {slug}
=====================================================================

This folder is a fully self-contained copy of the talk. Browsers block
some features on file:// pages, so serve it over a local HTTP server:

  with Python installed (any platform):
      python serve.py
      … then open  http://localhost:8000/

  or any other static server, e.g.:
      npx http-server .        (Node)
      php -S localhost:8000    (PHP)

Keyboard in the deck:  ←/→ navigate · T contents · O overview ·
F fullscreen · Esc closes overlays.

Live version: {url}
"""

SERVE = """#!/usr/bin/env python3
\"\"\"Serve this offline deck at http://localhost:8000/ (Ctrl+C stops it).\"\"\"
import http.server, os, webbrowser
os.chdir(os.path.dirname(os.path.abspath(__file__)))
webbrowser.open("http://localhost:8000/")
http.server.ThreadingHTTPServer(("127.0.0.1", 8000),
    http.server.SimpleHTTPRequestHandler).serve_forever()
"""


def add_tree(zf, src_dir, arc_prefix, skip=()):
    for root, _, names in os.walk(src_dir):
        for n in sorted(names):
            if n in skip:
                continue
            p = os.path.join(root, n)
            arc = os.path.join(arc_prefix, os.path.relpath(p, src_dir))
            zf.write(p, arc)


def build_zip(root, slug, site_url):
    deck_dir = os.path.join(root, "talks", slug)
    out = os.path.join(deck_dir, "offline.zip")
    with open(os.path.join(deck_dir, "index.html"), encoding="utf-8") as fh:
        html = fh.read().replace("../../shared/", "shared/")

    top = slug  # unpacks into a named folder, not a loose file spray
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(os.path.join(top, "index.html"), html)
        zf.writestr(os.path.join(top, "README.txt"),
                    README.format(slug=slug, url=f"{site_url}/talks/{slug}/"))
        zf.writestr(os.path.join(top, "serve.py"), SERVE)
        assets = os.path.join(deck_dir, "assets")
        if os.path.isdir(assets):
            add_tree(zf, assets, os.path.join(top, "assets"))
        # the deck's PDF travels along when it has already been exported
        pdf = os.path.join(deck_dir, "slides.pdf")
        if os.path.exists(pdf):
            zf.write(pdf, os.path.join(top, "slides.pdf"))
        add_tree(zf, os.path.join(root, "shared"), os.path.join(top, "shared"),
                 skip=("vendor-manifest.json",))
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=REPO, help="site root (default: the repo; use _site)")
    ap.add_argument("--decks", help="comma-separated slugs (default: every published deck)")
    args = ap.parse_args(argv)

    root = os.path.abspath(args.root)
    site_url = "https://slides.frederickmadore.com"
    talks = sorted(
        d for d in os.listdir(os.path.join(root, "talks"))
        if not d.startswith("_") and os.path.isfile(os.path.join(root, "talks", d, "index.html"))
    )
    if args.decks:
        talks = [t for t in talks if t in set(args.decks.split(","))]

    for slug in talks:
        out = build_zip(root, slug, site_url)
        print(f"ok    {slug}: {os.path.relpath(out, root)} "
              f"({os.path.getsize(out) / 1024 / 1024:.1f} MB)")
    print(f"\nbuild-offline: {len(talks)} bundle(s)")


if __name__ == "__main__":
    sys.exit(main())
