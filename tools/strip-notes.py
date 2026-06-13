#!/usr/bin/env python3
"""Build a publishable copy of the deck with speaker notes removed.

GitHub Pages would otherwise serve the repo as-is, exposing every speaker
note (via the `S` speaker view and view-source). This copies the site to a
destination directory and strips notes from the *copy*, so the deployed site
carries none. Two note forms are removed:

  • <aside class="notes"> ... </aside>                 (HTML slides)
  • a `Note:` block inside a <textarea data-template>  (Markdown slides; the
    Markdown plugin treats everything after `Note:` as the note, so we drop
    from that line to the end of the textarea)

Your repo keeps the notes — only the published copy is stripped.

Usage:
  python3 tools/strip-notes.py <dest>          # copy CWD → <dest>, then strip
  python3 tools/strip-notes.py <src> <dest>
"""
import os
import re
import shutil
import sys

# Repo-internal dirs that should never be published.
EXCLUDE = {".git", ".github", "tools"}

ASIDE_RE = re.compile(r'<aside\b[^>]*\bclass="notes"[^>]*>.*?</aside>',
                      re.DOTALL | re.IGNORECASE)
TEXTAREA_RE = re.compile(r'(<textarea\b[^>]*\bdata-template\b[^>]*>)(.*?)(</textarea>)',
                         re.DOTALL | re.IGNORECASE)
# Mirrors the Markdown plugin's notes separator: a line starting with Note(s):
NOTE_RE = re.compile(r'^[ \t]*notes?:', re.IGNORECASE | re.MULTILINE)

counts = {"aside": 0, "note": 0}


def _strip_textarea_note(m):
    open_tag, body, close_tag = m.group(1), m.group(2), m.group(3)
    nm = NOTE_RE.search(body)
    if nm:
        counts["note"] += 1
        body = body[:nm.start()].rstrip() + "\n      "
    return open_tag + body + close_tag


def strip_notes(html):
    html, n = ASIDE_RE.subn("", html)
    counts["aside"] += n
    return TEXTAREA_RE.sub(_strip_textarea_note, html)


def copy_tree(src, dest, skip_real):
    os.makedirs(dest, exist_ok=True)
    for name in os.listdir(src):
        if name in EXCLUDE:
            continue
        s = os.path.join(src, name)
        if os.path.realpath(s) == skip_real:   # never copy the dest into itself
            continue
        d = os.path.join(dest, name)
        if os.path.isdir(s):
            copy_tree(s, d, skip_real)
        else:
            shutil.copy2(s, d)


def main(argv):
    if len(argv) == 1:
        src, dest = ".", argv[0]
    elif len(argv) == 2:
        src, dest = argv
    else:
        sys.exit("usage: strip-notes.py [<src>] <dest>")

    dest_real = os.path.realpath(dest)
    if os.path.exists(dest):
        shutil.rmtree(dest)
    copy_tree(os.path.realpath(src), dest, dest_real)

    files = 0
    for root, _, names in os.walk(dest):
        for n in names:
            if n.endswith(".html"):
                p = os.path.join(root, n)
                with open(p, encoding="utf-8") as fh:
                    original = fh.read()
                stripped = strip_notes(original)
                if stripped != original:
                    with open(p, "w", encoding="utf-8") as fh:
                        fh.write(stripped)
                    files += 1

    print(f"published to {dest!r}: stripped {counts['aside']} <aside.notes> and "
          f"{counts['note']} Markdown Note: block(s) across {files} file(s)")


if __name__ == "__main__":
    main(sys.argv[1:])
