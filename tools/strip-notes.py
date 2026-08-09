#!/usr/bin/env python3
"""Build the publishable copy of the site: allowlisted files, speaker notes
stripped.

GitHub Pages would otherwise serve the repo as-is, exposing every speaker
note (via the `S` speaker view and view-source) along with development-only
files. This builds the artifact from an explicit ALLOWLIST — the live site,
not a near-complete copy of the repository:

  index.html · CNAME · .nojekyll · shared/ · talks/<slug>/  (non-underscored)

and strips notes from every copied HTML file. Three forms are removed:

  • <aside class="notes"> … </aside>       — any quoting style, any position
    of "notes" in the class list, any case, attributes across several lines
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
import re
import shutil
import sys

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

# <aside … class="…notes…" …> — matches any attribute order and spacing,
# single or double quotes, extra classes before/after, and uppercase markup.
ASIDE_RE = re.compile(
    r"<aside\b[^>]*\bclass\s*=\s*(?P<q>['\"])(?:[^'\"]*\s)?notes(?:\s[^'\"]*)?(?P=q)[^>]*>"
    r".*?</aside\s*>",
    re.DOTALL | re.IGNORECASE)
TEXTAREA_RE = re.compile(r"(<textarea\b[^>]*\bdata-template\b[^>]*>)(.*?)(</textarea>)",
                         re.DOTALL | re.IGNORECASE)
# Mirrors the Markdown plugin's notes separator: a line starting with Note(s):
NOTE_RE = re.compile(r"^[ \t]*notes?:", re.IGNORECASE | re.MULTILINE)
# The speaker-notes plugin: its <script> tag and its RevealNotes plugin hook.
NOTES_PLUGIN_RE = re.compile(r"[ \t]*<script[^>]*\bsrc\s*=\s*['\"][^'\"]*plugin/notes\.js['\"][^>]*>\s*</script>\n?",
                             re.IGNORECASE)


def strip_notes(html, counts):
    def _textarea(m):
        open_tag, body, close_tag = m.group(1), m.group(2), m.group(3)
        nm = NOTE_RE.search(body)
        if nm:
            counts["note"] += 1
            body = body[:nm.start()].rstrip() + "\n      "
        return open_tag + body + close_tag

    html, n = ASIDE_RE.subn("", html)
    counts["aside"] += n
    html, n = NOTES_PLUGIN_RE.subn("", html)
    counts["plugin"] += n
    return TEXTAREA_RE.sub(_textarea, html)


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


def build(src, dest):
    """Copy the allowlisted site into dest and strip notes. Returns counts."""
    src = os.path.realpath(src)
    dest_real = os.path.realpath(dest)
    # Refuse a destination that would clobber the source tree: the source
    # itself, or any ancestor of it (removing dest would remove the source).
    if dest_real == src or src.startswith(dest_real + os.sep):
        raise SystemExit(f"refusing destination {dest!r}: it contains the source tree")

    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)

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

    counts = {"aside": 0, "note": 0, "plugin": 0, "files": 0}
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
            if ASIDE_RE.search(html) or NOTES_PLUGIN_RE.search(html):
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
          f"{counts['note']} Markdown Note: block(s) and {counts['plugin']} notes-plugin "
          f"tag(s) across {counts['files']} file(s)")


if __name__ == "__main__":
    main(sys.argv[1:])
