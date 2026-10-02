"""Checksums and provenance checks for vendored dependencies."""
import json
import os
from .asset_audit import file_digest

def audit_vendor(rep, root):
    """Vendored third-party files must still match the digests we recorded.

    Two manifest shapes are in use: a single `file` with a bare `sha256`
    string (what tools/fetch-highlight.py writes), or a list of `files` with
    a `sha256` map. Map keys may be the path under shared/ or just a
    basename, as long as it resolves to exactly one listed file.
    """
    rel_manifest = os.path.join("shared", "vendor-manifest.json")
    path = os.path.join(root, rel_manifest)
    if not os.path.exists(path):
        rep.error(rel_manifest, "vendor manifest missing")
        return
    try:
        with open(path, encoding="utf-8") as fh:
            manifest = json.load(fh)
    except json.JSONDecodeError as e:
        rep.error(rel_manifest, f"unreadable vendor manifest: {e}")
        return

    for package, entry in sorted(manifest.items()):
        listed = list(entry.get("files") or ([entry["file"]] if entry.get("file") else []))
        if not listed:
            rep.warn(rel_manifest, f"{package}: no vendored file recorded")
            continue

        recorded = entry.get("sha256")
        if isinstance(recorded, str):
            recorded = {listed[0]: recorded}
        elif not isinstance(recorded, dict):
            recorded = {}

        wanted = {}
        for key, digest in recorded.items():
            matches = [key] if key in listed else [f for f in listed if os.path.basename(f) == key]
            if len(matches) != 1:
                rep.error(rel_manifest,
                          f"{package}: sha256 key {key!r} does not name one listed file")
                continue
            wanted[matches[0]] = digest

        for rel in listed:
            target = os.path.join(root, "shared", rel)
            if not os.path.exists(target):
                rep.error(rel_manifest, f"{package}: vendored file missing: shared/{rel}")
                continue
            if rel not in wanted:
                rep.warn(rel_manifest, f"{package}: no sha256 recorded for shared/{rel}")
                continue
            got = file_digest(target, "sha256")
            if got != wanted[rel]:
                rep.error(os.path.join("shared", rel),
                          f"{package}: vendored file no longer matches the manifest — "
                          f"sha256 is {got}, manifest says {wanted[rel]} (restore the "
                          f"vendored build, or record the new digest deliberately)")

