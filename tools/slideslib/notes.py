"""HTML-aware note removal that preserves all unrelated source bytes."""
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit

ATTR = re.compile(r'''\s+([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?''')
NOTE = re.compile(r"^[ \t]*notes?:", re.I | re.M)


def note_kind(tag, attrs):
    values = dict(attrs)
    if tag == "aside" and "notes" in (values.get("class") or "").lower().split():
        return "aside"
    if tag == "script" and urlsplit(values.get("src") or "").path.endswith("/plugin/notes.js"):
        return "plugin"
    return None


class NoteScan(HTMLParser):
    """Independent output assertion: inspect semantics, not removal spans."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.found = set()
        self.template = False

    def handle_starttag(self, tag, attrs):
        kind = note_kind(tag, attrs)
        if kind:
            self.found.add(kind)
        if any(name == "data-notes" for name, _ in attrs):
            self.found.add("attr")
        if tag == "textarea":
            self.template = "data-template" in dict(attrs)

    handle_startendtag = handle_starttag

    def handle_endtag(self, tag):
        if tag == "textarea":
            self.template = False

    def handle_data(self, data):
        if self.template and NOTE.search(data):
            self.found.add("note")


def remaining_notes(html):
    parser = NoteScan()
    parser.feed(html)
    parser.close()
    return parser.found


class NoteRemover(HTMLParser):
    def __init__(self, html, counts):
        super().__init__(convert_charrefs=False)
        self.html, self.counts = html, counts
        self.lines = [0] + [m.end() for m in re.finditer("\n", html)]
        self.spans = []
        self.removing = None
        self.depth = 0
        self.template_start = None

    def source_offset(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start, raw = self.source_offset(), self.get_starttag_text()
        if self.removing:
            if tag == self.removing[0]:
                self.depth += 1
            return
        kind = note_kind(tag, attrs)
        if kind:
            self.removing, self.depth = (tag, start), 1
            self.counts[kind] += 1
            return
        for match in ATTR.finditer(raw):
            if match[1].lower() == "data-notes":
                self.spans.append((start + match.start(), start + match.end()))
                self.counts["attr"] += 1
        if tag == "textarea" and "data-template" in dict(attrs):
            self.template_start = start + len(raw)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.removing and self.removing[0] == tag:
            self.depth -= 1
            if not self.depth:
                self.spans.append((self.removing[1], self.source_offset() + len(self.get_starttag_text())))
                self.removing = None

    def handle_endtag(self, tag):
        if self.removing and self.removing[0] == tag:
            self.depth -= 1
            if not self.depth:
                self.spans.append((self.removing[1], self.html.index(">", self.source_offset()) + 1))
                self.removing = None
        if tag == "textarea" and self.template_start is not None:
            match = NOTE.search(self.html[self.template_start:self.source_offset()])
            if match:
                self.spans.append((self.template_start + match.start(), self.source_offset()))
                self.counts["note"] += 1
            self.template_start = None


def strip_html_notes(html, counts):
    parser = NoteRemover(html, counts)
    parser.feed(html)
    parser.close()
    if parser.removing:
        raise ValueError("unclosed speaker-note element; refusing to discard the rest of the document")
    for start, end in sorted(parser.spans, reverse=True):
        html = html[:start] + html[end:]
    return html
