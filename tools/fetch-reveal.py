#!/usr/bin/env python3
"""Vendor an explicit official reveal.js release, preserving offline paths.

Usage: python3 tools/fetch-reveal.py 6.0.2 [--dry-run]

Download the npm release archive, verify its SHA-512 integrity, and validate
package identity before staging the six dist files, licence notice and manifest.
Re-running a recorded version also requires its recorded archive integrity to
match. All downloads and JavaScript syntax checks finish before tracked files
change; failed replacements roll back the entire update. Requires Node.js.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = "https://registry.npmjs.org/reveal.js"
VERSION_RE = re.compile(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)")
MAX_BYTES = 16 * 1024 * 1024
FILES = {
    "reveal/reveal.js": "package/dist/reveal.js",
    "reveal/reveal.css": "package/dist/reveal.css",
    "reveal/reset.css": "package/dist/reset.css",
    "reveal/plugin/notes.js": "package/dist/plugin/notes.js",
    "reveal/plugin/zoom.js": "package/dist/plugin/zoom.js",
    "reveal/plugin/search.js": "package/dist/plugin/search.js",
}


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "slides-vendor-update/1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        value = response.read(MAX_BYTES + 1)
    if not value or len(value) > MAX_BYTES:
        raise ValueError(f"empty or oversized response: {url}")
    return value


def verify_integrity(archive: bytes, integrity: str) -> None:
    if not isinstance(integrity, str) or not integrity.startswith("sha512-"):
        raise ValueError("release must provide SHA-512 archive integrity")
    try:
        expected = base64.b64decode(integrity[7:], validate=True)
    except ValueError as error:
        raise ValueError("invalid SHA-512 archive integrity") from error
    if len(expected) != 64 or hashlib.sha512(archive).digest() != expected:
        raise ValueError("release archive does not match its SHA-512 integrity")


def archive_files(archive: bytes) -> dict[str, bytes]:
    """Read only expected regular files, never extract paths onto disk."""
    wanted = set(FILES.values()) | {"package/package.json", "package/LICENSE"}
    result = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as package:
        for member in package:
            if member.name not in wanted:
                continue
            if (member.name in result or not member.isfile()
                    or not 0 < member.size <= MAX_BYTES):
                raise ValueError(f"invalid or duplicate archive member: {member.name}")
            with package.extractfile(member) as handle:
                value = handle.read(MAX_BYTES + 1)
            if len(value) != member.size:
                raise ValueError(f"truncated archive member: {member.name}")
            value.decode("utf-8")
            result[member.name] = value
    missing = wanted - result.keys()
    if missing:
        raise ValueError(f"release archive missing: {', '.join(sorted(missing))}")
    return result


def syntax_check(outputs: dict[str, bytes]) -> None:
    with tempfile.TemporaryDirectory(prefix="reveal-staging-") as temporary:
        for relative, value in outputs.items():
            if not relative.endswith(".js"):
                continue
            staged = Path(temporary) / Path(relative).name
            staged.write_bytes(value)
            try:
                subprocess.run(["node", "--check", str(staged)], check=True,
                               capture_output=True, text=True)
            except FileNotFoundError as error:
                raise ValueError("Node.js is required to validate the staged JavaScript") from error
            except subprocess.CalledProcessError as error:
                raise ValueError(f"{relative}: JavaScript syntax check failed:\n{error.stderr}") from error


def build_update(root: Path, version: str) -> dict[Path, bytes]:
    if not VERSION_RE.fullmatch(version):
        raise ValueError("specify an exact stable version, such as 6.0.2")
    manifest_path = root / "shared/vendor-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    metadata = json.loads(download(f"{REGISTRY}/{version}"))
    if (metadata.get("name") != "reveal.js" or metadata.get("version") != version
            or metadata.get("license") != "MIT"):
        raise ValueError("unexpected reveal.js release identity or licence")
    dist = metadata.get("dist", {})
    tarball = f"{REGISTRY}/-/reveal.js-{version}.tgz"
    if dist.get("tarball") != tarball:
        raise ValueError("release archive URL must be the official versioned npm tarball")
    integrity = dist.get("integrity")
    previous = manifest.get("reveal.js", {})
    if previous.get("version") == version:
        recorded = previous.get("dist", {}).get("integrity")
        if recorded is not None and recorded != integrity:
            raise ValueError("registry integrity differs from the recorded release; update aborted")
    commit = metadata.get("gitHead", "")
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("release must identify its upstream git commit")
    archive = download(tarball)
    verify_integrity(archive, integrity)
    contents = archive_files(archive)
    package = json.loads(contents["package/package.json"])
    if (package.get("name") != "reveal.js" or package.get("version") != version
            or package.get("license") != "MIT"):
        raise ValueError("archive package identity does not match the requested release")
    outputs = {local: contents[remote] for local, remote in FILES.items()}
    syntax_check(outputs)

    notice_path = root / "THIRD_PARTY_NOTICES.md"
    notices = notice_path.read_text(encoding="utf-8")
    license_text = contents["package/LICENSE"].decode("utf-8").strip()
    if "Permission is hereby granted" not in license_text or "```" in license_text:
        raise ValueError("unexpected upstream MIT licence content")
    section = (
        f"## reveal.js — MIT\n\n"
        f"Vendored at `shared/reveal/` (v{version}, dist build + notes/zoom/search plugins).\n"
        "<https://revealjs.com> · <https://github.com/hakimel/reveal.js>\n\n"
        "Reproduce with `python3 tools/fetch-reveal.py " + version + "`. The official npm\n"
        "archive integrity and upstream commit are pinned in the vendor manifest.\n\n"
        f"```text\n{license_text}\n```\n\n"
    )
    notices, count = re.subn(r"## reveal\.js — MIT\n.*?(?=\n## )",
                             lambda _: section.rstrip() + "\n", notices, flags=re.S)
    if count != 1:
        raise ValueError("expected exactly one reveal.js third-party notice section")
    manifest["reveal.js"] = {
        "version": version,
        "source": f"https://github.com/hakimel/reveal.js/tree/{commit}",
        "dist": {"tarball": tarball, "integrity": integrity, "gitHead": commit},
        "files": list(FILES),
        "license": "MIT",
        "sha256": {local: hashlib.sha256(value).hexdigest() for local, value in outputs.items()},
    }
    return {
        **{root / "shared" / local: value for local, value in outputs.items()},
        notice_path: notices.encode("utf-8"),
        manifest_path: (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    }


def atomic_write(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(value)
        os.chmod(temporary, path.stat().st_mode & 0o777 if path.exists() else 0o644)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def install(outputs: dict[Path, bytes]) -> None:
    backups = {path: path.read_bytes() if path.exists() else None for path in outputs}
    changed = []
    try:
        for path, value in outputs.items():
            if backups[path] == value:
                continue
            atomic_write(path, value)
            changed.append(path)
    except BaseException:
        for path in reversed(changed):
            if backups[path] is None:
                path.unlink(missing_ok=True)
            else:
                atomic_write(path, backups[path])
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", help="exact official stable release, e.g. 6.0.2")
    parser.add_argument("--root", type=Path, default=ROOT, help="repository root")
    parser.add_argument("--dry-run", action="store_true", help="validate without changing files")
    args = parser.parse_args(argv)
    try:
        outputs = build_update(args.root, args.version)
        if not args.dry_run:
            install(outputs)
    except (OSError, ValueError, tarfile.TarError, urllib.error.URLError) as error:
        print(f"reveal.js update failed: {error}", file=sys.stderr)
        return 1
    print(f"{'Validated' if args.dry_run else 'Vendored'} reveal.js {args.version}: "
          f"{len(FILES)} files, notices and integrity manifest")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
