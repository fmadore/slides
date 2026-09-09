#!/usr/bin/env python3
"""Build the publishable copy of the site: allowlisted files, speaker notes
stripped.

GitHub Pages would otherwise serve the repo as-is, exposing every speaker
note (via the `S` speaker view and view-source) along with development-only
files. This builds the artifact from an explicit ALLOWLIST — the live site,
not a near-complete copy of the repository:

  index.html · CNAME · .nojekyll · shared/ · talks/<slug>/  (non-underscored)

and strips notes from every copied HTML file. Four forms are removed:

  • <aside class="notes"> … </aside>       — any quoting style, any position
    of "notes" in the class list, any case, attributes across several lines
  • a data-notes="…" attribute on any element   (reveal's attribute form)
  • a `Note:` block inside a <textarea data-template>   (Markdown slides)
  • the reveal notes-plugin <script> tag (the plugin file is not copied)

After writing, the build re-scans its own output and fails loudly if any
note block survived. Your repo keeps the notes — only the published copy is
stripped. (The source repository is public, so notes remain readable on
GitHub; truly confidential notes must live outside this repository.)

Usage:
  python3 tools/strip-notes.py <dest>          # build CWD → <dest>
  python3 tools/strip-notes.py <src> <dest>
"""
import os
import json
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from slideslib.notes import remaining_notes, strip_html_notes

# What gets published (relative to the source root). Talk folders are added
# dynamically: every talks/<dir>/ that does not start with "_".
ALLOWLIST = ["index.html", "404.html", "robots.txt", "sitemap.xml",
             "CNAME", ".nojekyll", "shared"]

# Never copy these even inside allowlisted trees.
SKIP_NAMES = {
    ".gitkeep",
    "notes.js",             # reveal speaker-notes plugin
    "src",                  # source partials; generated theme.css/deck.js ship
    "vendor-manifest.json", # development-time integrity metadata
}

def strip_notes(html, counts):
    return strip_html_notes(html, counts)


def copy_tree(src, dest):
    os.makedirs(dest, exist_ok=True)
    for name in sorted(os.listdir(src)):
        if name in SKIP_NAMES:
            continue
        s, d = os.path.join(src, name), os.path.join(dest, name)
        if os.path.isdir(s):
            copy_tree(s, d)
        else:
            shutil.copy2(s, d)


BUILD_MARKER = ".slides-build.json"


def within(path, parent):
    try:
        return os.path.commonpath([os.path.normcase(path), os.path.normcase(parent)]) == os.path.normcase(parent)
    except ValueError:
        return False


def build(src, dest):
    """Stage and verify before replacing an output owned by this builder."""
    src, dest = os.path.realpath(src), os.path.realpath(dest)
    inputs = [os.path.join(src, name) for name in ALLOWLIST + ["talks", "tools", ".git", "docs"]]
    if within(src, dest) or any(within(dest, path) or within(path, dest) for path in inputs):
        raise SystemExit(f"refusing destination {dest!r}: overlaps source inputs")
    if os.path.exists(dest):
        try:
            with open(os.path.join(dest, BUILD_MARKER), encoding="utf-8") as fh:
                owned = json.load(fh) == {"source": src}
        except (OSError, ValueError):
            owned = False
        if not owned:
            raise SystemExit(f"refusing destination {dest!r}: not a marked slides build; choose a new directory")
    parent = os.path.dirname(dest)
    os.makedirs(parent, exist_ok=True)
    stage = tempfile.mkdtemp(prefix=".slides-stage-", dir=parent)
    backup = None
    published = False
    try:
        counts = populate(src, stage)
        with open(os.path.join(stage, BUILD_MARKER), "w", encoding="utf-8") as fh:
            json.dump({"source": src}, fh)
        if os.path.exists(dest):
            backup = tempfile.mkdtemp(prefix=".slides-backup-", dir=parent)
            os.rmdir(backup)
            os.replace(dest, backup)
        try:
            os.replace(stage, dest)
            published = True
        except OSError:
            if backup:
                os.replace(backup, dest)
                backup = None
            raise
        return counts
    finally:
        # Both paths were allocated by mkdtemp directly under this parent.
        # Preserve the old build if restoring it also fails (e.g. a file lock).
        for owned_path in (stage, backup if published else None):
            if owned_path and within(os.path.realpath(owned_path), parent) and os.path.isdir(owned_path):
                shutil.rmtree(owned_path)


def populate(src, dest):
    """Populate a fresh, owned staging directory."""

    entries = list(ALLOWLIST)
    talks_dir = os.path.join(src, "talks")
    if os.path.isdir(talks_dir):
        for d in sorted(os.listdir(talks_dir)):
            if not d.startswith("_") and os.path.isdir(os.path.join(talks_dir, d)):
                entries.append(os.path.join("talks", d))

    for rel in entries:
        s = os.path.join(src, rel)
        if not os.path.exists(s):
            continue
        d = os.path.join(dest, rel)
        if os.path.isdir(s):
            copy_tree(s, d)
        else:
            os.makedirs(os.path.dirname(d) or dest, exist_ok=True)
            shutil.copy2(s, d)

    counts = {"aside": 0, "attr": 0, "note": 0, "plugin": 0, "files": 0}
    for root, _, names in os.walk(dest):
        for n in names:
            if not n.endswith(".html"):
                continue
            p = os.path.join(root, n)
            with open(p, encoding="utf-8") as fh:
                original = fh.read()
            stripped = strip_notes(original, counts)
            if stripped != original:
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(stripped)
                counts["files"] += 1

    # Post-build assertion: the artifact must be completely notes-free.
    leftovers = []
    for root, _, names in os.walk(dest):
        for n in names:
            if not n.endswith(".html"):
                continue
            p = os.path.join(root, n)
            with open(p, encoding="utf-8") as fh:
                html = fh.read()
            if remaining_notes(html):
                leftovers.append(os.path.relpath(p, dest))
    if leftovers:
        raise SystemExit("note blocks survived the strip: " + ", ".join(leftovers))
    return counts


def main(argv):
    if len(argv) == 1:
        src, dest = ".", argv[0]
    elif len(argv) == 2:
        src, dest = argv
    else:
        sys.exit("usage: strip-notes.py [<src>] <dest>")

    counts = build(src, dest)
    print(f"published to {dest!r}: stripped {counts['aside']} <aside class=notes>, "
          f"{counts['attr']} data-notes attribute(s), {counts['note']} Markdown Note: block(s) "
          f"and {counts['plugin']} notes-plugin tag(s) across {counts['files']} file(s)")


if __name__ == "__main__":
    main(sys.argv[1:])
