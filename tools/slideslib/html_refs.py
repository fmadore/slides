"""HTML/CSS reference parsing shared by auditing, preflight and publication."""
import os
import re
from html.parser import HTMLParser
from urllib.parse import unquote, urlparse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PRUNED_DIRS = {".git", ".claude", "node_modules", "_site", "__pycache__"}

class DeckParser(HTMLParser):
    """Collect the references and structures the audit cares about."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []          # (kind, value)  local-or-remote references
        self.ids = []
        self.imgs_without_alt = []
        self.iframes_without_title = []
        self.blank_without_noopener = []
        self.fit_allow_without_reason = []
        self.notes = 0
        self.styles = []        # (css source, first line)  per-deck <style> blocks
        self.inline_styles = []  # (declarations, line)      style="…" attributes
        self._in_style = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if (a.get("style") or "").strip():
            self.inline_styles.append((a["style"], self.getpos()[0]))
        if tag == "style":
            self._in_style = True
        if tag == "section" and "data-fit-allow" in a and not (a.get("data-fit-allow") or "").strip():
            self.fit_allow_without_reason.append(a.get("id") or a.get("data-toc") or "<section>")
        if tag == "img":
            src = a.get("src") or a.get("data-src")
            if src:
                self.refs.append(("img", src))
            if "alt" not in a:
                self.imgs_without_alt.append(src or "<inline>")
            self._add_srcset("img", a.get("srcset") or a.get("data-srcset"))
        elif tag == "script" and a.get("src"):
            self.refs.append(("script", a["src"]))
        elif tag == "link" and a.get("href"):
            self.refs.append(("link", a["href"]))
        elif tag == "iframe":
            src = a.get("src") or a.get("data-src")
            if src:
                self.refs.append(("iframe", src))
            if not (a.get("title") or "").strip():
                self.iframes_without_title.append(src or "<inline>")
        elif tag == "source":
            if a.get("src"):
                self.refs.append(("source", a["src"]))
            self._add_srcset("source", a.get("srcset"))
        elif tag in {"audio", "video"}:
            if a.get("src"):
                self.refs.append((tag, a["src"]))
            if tag == "video" and a.get("poster"):
                self.refs.append(("poster", a["poster"]))
        elif tag == "object" and a.get("data"):
            self.refs.append(("object", a["data"]))
        elif tag == "a" and a.get("href"):
            self.refs.append(("a", a["href"]))
            if a.get("target") == "_blank" and "noopener" not in (a.get("rel") or ""):
                self.blank_without_noopener.append(a["href"])
        elif tag == "aside" and "notes" in (a.get("class") or "").split():
            self.notes += 1
        for key in ("data-skill-src", "data-embed-src"):
            if a.get(key):
                self.refs.append(("embed", a[key]))

    def handle_endtag(self, tag):
        if tag == "style":
            self._in_style = False

    def handle_data(self, data):
        # getpos() is the start of this data chunk, so a rule's line number
        # stays true to the file the author reads.
        if self._in_style and data.strip():
            self.styles.append((data, self.getpos()[0]))

    def _add_srcset(self, kind, value):
        if not value:
            return
        for candidate in value.split(","):
            fields = candidate.strip().split(maxsplit=1)
            if fields:
                self.refs.append((kind, fields[0]))


def is_local(url):
    try:
        p = urlparse(url)
    except ValueError:      # malformed (e.g. an unclosed IPv6 literal)
        return False        # not ours to resolve; check-links.py reports it
    return not p.scheme and not url.startswith(("#", "//", "mailto:", "data:"))


def local_path(base_dir, url, root=None):
    path = unquote(urlparse(url).path)
    if not path:
        return None
    if path.startswith("/"):   # root-absolute (e.g. the 404 page, served at any depth)
        return os.path.normpath(os.path.join(root or PROJECT_ROOT, path.lstrip("/")))
    return os.path.normpath(os.path.join(base_dir, path))


def is_within(path, root):
    try:
        return os.path.commonpath((os.path.abspath(path), os.path.abspath(root))) == os.path.abspath(root)
    except ValueError:  # different drives on Windows
        return False


def iter_html(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in PRUNED_DIRS]
        for n in filenames:
            if n.endswith(".html"):
                yield os.path.join(dirpath, n)


CSS_REF_RE = re.compile(
    r"url\(\s*(?P<uq>[^)'\"\s][^)]*?)\s*\)"
    r"|url\(\s*(?P<q>['\"])(?P<quoted>.*?)(?P=q)\s*\)"
    r"|@import\s+(?P<iq>['\"])(?P<imported>.*?)(?P=iq)",
    re.IGNORECASE,
)


def css_references(source):
    for match in CSS_REF_RE.finditer(source):
        yield match.group("uq") or match.group("quoted") or match.group("imported")

