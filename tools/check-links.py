#!/usr/bin/env python3
"""External link check for the published decks — deliberately NOT part of CI.

tools/browser-check.mjs ignores external resource failures on purpose so pull
requests stay hermetic and fast. Nothing else ever notices when a link in a
published talk rots, so this runs on a weekly schedule instead (see
.github/workflows/link-check.yml) and opens an issue when something breaks.

Every http(s) URL reachable from the landing page, the 404 page and each
published deck is probed with HEAD, falling back to GET for servers that
refuse it. Results are graded, because "not 200" is not the same as "broken":

  dead        404 / 410 / 451, an unresolvable host, a refused connection or a
              bad certificate — evidence the link itself is gone. Exit 1.
  unverified  401 / 403 / 429 / 5xx / timeouts — bot walls, rate limits and
              blips. Reported for a human to glance at, but never on its own
              a reason to open an issue. Pass --strict to treat these as dead.

Draft decks (talks/_template, talks/_showcase) are skipped: they carry
deliberate placeholder URLs.

Usage:
  python3 tools/check-links.py
  python3 tools/check-links.py --markdown report.md --json report.json
  python3 tools/check-links.py --skip linkedin.com --skip example.com
"""
import argparse
import concurrent.futures
import hashlib
import http.client
import importlib.util
import json
import os
import socket
import ssl
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Reuse the audit's HTML parser so both tools agree on what counts as a
# reference (a/href, img, script, link, iframe, source, data-*-src).
_spec = importlib.util.spec_from_file_location("audit", os.path.join(HERE, "audit.py"))
audit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(audit)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en,fr;q=0.9",
}

# Servers that answer HEAD with one of these are not saying the page is gone,
# they are saying "not like that" — ask again with GET before believing them.
RETRY_WITH_GET = {400, 401, 403, 405, 406, 409, 429, 500, 501, 503}

# Statuses that mean the resource itself is gone, as opposed to guarded.
GONE = {404, 410, 451}


class Result:
    def __init__(self, url, grade, detail, sources):
        self.url, self.grade, self.detail, self.sources = url, grade, detail, sources

    def as_dict(self):
        return {"url": self.url, "grade": self.grade, "detail": self.detail,
                "sources": self.sources}


def iter_published_html(root):
    """The landing page, the 404 page and every published deck — not drafts."""
    for path in audit.iter_html(root):
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        parts = rel.split("/")
        if parts[0] == "tools":
            continue
        if parts[0] == "talks" and (len(parts) < 2 or parts[1].startswith("_")):
            continue
        yield path, rel


def is_external(url):
    """Is this meant to be an http(s) URL? A malformed one still counts — the
    point is to report the typo, not to quietly drop it."""
    try:
        return urlparse(url).scheme in ("http", "https")
    except ValueError:
        return url.lower().startswith(("http://", "https://"))


def collect(root, skip):
    """url -> sorted list of files referencing it."""
    found = {}
    for path, rel in iter_published_html(root):
        with open(path, encoding="utf-8") as fh:
            parser = audit.DeckParser()
            parser.feed(fh.read())
        for _kind, url in parser.refs:
            if url.startswith("//"):
                url = "https:" + url
            if not is_external(url):
                continue
            if any(s in url for s in skip):
                continue
            found.setdefault(url.split("#")[0], set()).add(rel)
    return {u: sorted(s) for u, s in sorted(found.items())}


def classify_error(exc):
    """Map a transport failure onto (grade, human-readable detail)."""
    reason = getattr(exc, "reason", exc)
    text = str(reason) or type(exc).__name__
    # A URL that cannot even be parsed or IDNA-encoded is a typo in the deck,
    # not a flaky host — worth reporting rather than shrugging at.
    if isinstance(exc, (ValueError, http.client.InvalidURL)) or (
            isinstance(reason, str)
            and ("no host given" in reason or "unknown url type" in reason)):
        return "dead", f"malformed URL ({text})"
    if isinstance(reason, socket.gaierror):
        return "dead", f"host does not resolve ({text})"
    if isinstance(reason, ssl.SSLCertVerificationError):
        return "dead", f"certificate not valid ({text})"
    if isinstance(reason, ConnectionRefusedError):
        return "dead", f"connection refused ({text})"
    if isinstance(reason, (socket.timeout, TimeoutError)):
        return "unverified", "timed out"
    return "unverified", text


def probe(url, timeout):
    """HEAD, then GET where HEAD is unwelcome. Returns (grade, detail)."""
    last = None
    for method in ("HEAD", "GET"):
        try:
            # Request() itself raises on a malformed URL — a typo in a deck
            # should be reported like any other bad link, not crash the run.
            request = urllib.request.Request(url, method=method, headers=dict(HEADERS))
            if method == "GET":
                request.add_header("Range", "bytes=0-0")  # don't pull the whole page
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return "ok", f"HTTP {response.status}"
        except urllib.error.HTTPError as e:
            # Some servers send a nonsense reason phrase ("<none>" on LinkedIn's
            # 999); angle brackets would also render as markup in the report.
            reason = str(e.reason or "").strip()
            detail = f"HTTP {e.code} {reason}" if reason and "<" not in reason else f"HTTP {e.code}"
            last = ("dead" if e.code in GONE else "unverified", detail)
            if method == "HEAD" and e.code in RETRY_WITH_GET:
                continue
            return last
        except Exception as e:  # URLError, timeouts, resets, malformed URLs
            last = classify_error(e)
            if method == "HEAD":
                continue
            return last
    return last


def check(urls, timeout, workers, attempts):
    """Probe every URL, retrying anything that did not come back ok."""
    results = {}
    pending = list(urls)
    for attempt in range(1, attempts + 1):
        if not pending:
            break
        if attempt > 1:
            print(f"  retrying {len(pending)} unhappy URL(s) (attempt {attempt})…")
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(probe, u, timeout): u for u in pending}
            for future in concurrent.futures.as_completed(futures):
                url = futures[future]
                try:
                    grade, detail = future.result()
                except Exception as e:  # never let one odd URL sink the run
                    grade, detail = "unverified", f"probe failed: {type(e).__name__}: {e}"
                results[url] = Result(url, grade, detail, urls[url])
        pending = [u for u in pending if results[u].grade != "ok"]
    return [results[u] for u in urls]


def fingerprint(dead):
    """A stable id for *which* links are dead, so the workflow can tell a
    changed report from an unchanged one. Deliberately ignores the unverified
    list: bot walls flip between 403 and 429 week to week and would otherwise
    look like news every time."""
    joined = "\n".join(sorted(r.url for r in dead))
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()[:12] if dead else "clean"


def render_markdown(dead, unverified, checked):
    """Issue body. The marker lets the workflow find and update its own issue."""
    lines = [f"<!-- link-check-report fingerprint={fingerprint(dead)} -->",
             f"The weekly link check probed **{checked}** external URL(s) "
             "in the published decks.", ""]
    if dead:
        lines += [f"## Dead links ({len(dead)})", "",
                  "These returned a gone-for-good response, or their host could "
                  "not be reached at all.", ""]
        for r in dead:
            lines.append(f"- <{r.url}> — **{r.detail}**")
            for src in r.sources:
                lines.append(f"  - referenced by `{src}`")
        lines.append("")
    if unverified:
        lines += [f"## Could not verify ({len(unverified)})", "",
                  "Bot walls, rate limits and timeouts. Usually fine — worth a "
                  "glance only if one keeps reappearing week after week.", ""]
        for r in unverified:
            lines.append(f"- <{r.url}> — {r.detail} (`{'`, `'.join(r.sources)}`)")
        lines.append("")
    lines.append("Re-run locally with `python3 tools/check-links.py`.")
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=ROOT, help="repository root to scan")
    ap.add_argument("--timeout", type=float, default=20.0, help="per-request timeout (s)")
    ap.add_argument("--workers", type=int, default=8, help="concurrent requests")
    ap.add_argument("--attempts", type=int, default=2, help="tries before believing a failure")
    ap.add_argument("--skip", action="append", default=[], metavar="SUBSTRING",
                    help="ignore URLs containing SUBSTRING (repeatable)")
    ap.add_argument("--markdown", metavar="FILE", help="write an issue-ready report")
    ap.add_argument("--json", metavar="FILE", help="write the full results as JSON")
    ap.add_argument("--strict", action="store_true",
                    help="treat unverifiable links as dead too")
    args = ap.parse_args(argv)

    urls = collect(os.path.abspath(args.root), args.skip)
    if not urls:
        print("check-links: no external URLs found")
        return 0
    print(f"check-links: probing {len(urls)} external URL(s)…")
    results = check(urls, args.timeout, args.workers, max(1, args.attempts))

    dead = [r for r in results if r.grade == "dead"]
    unverified = [r for r in results if r.grade == "unverified"]
    if args.strict:
        dead, unverified = dead + unverified, []

    for r in dead:
        print(f"DEAD   {r.url} — {r.detail}")
        for src in r.sources:
            print(f"         referenced by {src}")
    for r in unverified:
        print(f"?      {r.url} — {r.detail}")
    print(f"\ncheck-links: {len(dead)} dead, {len(unverified)} unverified, "
          f"{len(results) - len(dead) - len(unverified)} ok")

    if args.markdown:
        with open(args.markdown, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(render_markdown(dead, unverified, len(results)))
    if args.json:
        with open(args.json, "w", encoding="utf-8", newline="\n") as fh:
            json.dump({"checked": len(results), "fingerprint": fingerprint(dead),
                       "results": [r.as_dict() for r in results]}, fh, indent=2)
            fh.write("\n")
    return 1 if dead else 0


if __name__ == "__main__":
    sys.exit(main())
