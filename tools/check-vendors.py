#!/usr/bin/env python3
"""Read-only freshness check for versioned vendored runtime dependencies.

Queries the official npm registry's latest stable release metadata for reveal.js
and highlight.js. Fonts have no comparable version field and are not checked.
Exit 0: all current; 1: version mismatch; 2: lookup or manifest validation failed.
This checks release freshness, not security advisories or local file integrity
(the latter remains the offline audit's responsibility).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
PACKAGES = ("reveal.js", "highlight.js")
VERSION_RE = re.compile(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)")


def fetch_latest(package: str) -> dict:
    url = f"https://registry.npmjs.org/{package}/latest"
    request = urllib.request.Request(url, headers={"User-Agent": "slides-vendor-check/1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        value = response.read(1024 * 1024 + 1)
    if len(value) > 1024 * 1024:
        raise ValueError("registry metadata exceeds 1 MiB")
    return json.loads(value)


def version_tuple(value: str) -> tuple[int, ...]:
    if not isinstance(value, str) or not VERSION_RE.fullmatch(value):
        raise ValueError(f"expected a stable version, received {value!r}")
    return tuple(map(int, value.split(".")))


def check(manifest: dict, fetch=fetch_latest) -> tuple[list[dict], int]:
    results = []
    exit_code = 0
    for package in PACKAGES:
        result = {"package": package, "vendored": None, "latest": None,
                  "source": f"https://registry.npmjs.org/{package}/latest"}
        try:
            current = manifest[package]["version"]
            current_parts = version_tuple(current)
            result["vendored"] = current
            metadata = fetch(package)
            if metadata.get("name") != package:
                raise ValueError("registry package identity mismatch")
            latest = metadata.get("version")
            latest_parts = version_tuple(latest)
            result["latest"] = latest
            result["status"] = ("current" if current_parts == latest_parts else
                                "update-available" if current_parts < latest_parts else
                                "ahead-of-latest")
            if result["status"] != "current":
                exit_code = max(exit_code, 1)
        except (OSError, ValueError, KeyError, TypeError, AttributeError, urllib.error.URLError) as error:
            result.update(status="error", error=str(error))
            exit_code = 2
        results.append(result)
    return results, exit_code


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="repository root")
    parser.add_argument("--json", action="store_true", help="machine-readable report on stdout")
    args = parser.parse_args(argv)
    try:
        manifest = json.loads((args.root / "shared/vendor-manifest.json").read_text(encoding="utf-8"))
        results, code = check(manifest)
    except (OSError, ValueError) as error:
        if args.json:
            print(json.dumps({"ok": False, "packages": [], "error": str(error)}, indent=2))
        else:
            print(f"vendor check failed: {error}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps({"ok": code == 0, "packages": results}, indent=2))
    else:
        for result in results:
            print(f"{result['package']}: vendored {result['vendored'] or '?'}; "
                  f"latest {result['latest'] or '?'} — {result['status']}")
            if result.get("error"):
                print(f"  {result['error']}")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
