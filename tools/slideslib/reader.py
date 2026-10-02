"""Build a static reading edition from the authored, public slide content.

No Reveal runtime, per-talk styling or script is copied. The HTML parser keeps
semantic content and local asset paths, so read.html can live beside index.html
and work on a static host or offline. Speaker notes are removed before parsing.
"""
from __future__ import annotations

from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from .deck_metadata import render_citation
from .notes import strip_html_notes
from .publication import is_excluded

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
DROP = {"script", "style", "button", "input", "form", "textarea", "template", "object", "embed"}
TAGS = {"a", "abbr", "aside", "b", "blockquote", "br", "caption", "cite", "code", "col", "colgroup", "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "kbd", "li", "mark", "ol", "p", "pre", "q", "s", "samp", "section", "small", "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var", "wbr"}
ATTRS = {"class", "title", "lang", "dir", "alt", "width", "height", "colspan", "rowspan", "scope", "start", "reversed", "value", "datetime", "cite", "open"}
FALLBACK_CLASSES = {"frame-fallback", "viz-fallback", "amrc-fallback"}
CHROME_CLASSES = {"slides-qr", "site-qr", "demo-qr", "scroll-hint", "flow-arrow", "dot", "folio-ghost", "note-cue"}


class Element:
    def __init__(self, tag="", attrs=()):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []

    @property
    def classes(self):
        return set((self.attrs.get("class") or "").split())


class Tree(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Element()
        self.stack = [self.root]
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, text):
        self.stack[-1].children.append(text)


def walk(node):
    yield node
    for child in node.children:
        if isinstance(child, Element):
            yield from walk(child)


def excluded(node):
    return (node.tag in DROP or "notes" in node.classes or "data-private" in node.attrs
            or node.attrs.get("data-visibility") == "hidden"
            or node.attrs.get("aria-hidden") == "true"
            or bool(node.classes & CHROME_CLASSES)
            or ("hidden" in node.attrs and not node.classes & FALLBACK_CLASSES))


def public_text(node):
    if isinstance(node, str):
        return node
    if excluded(node):
        return ""
    return " ".join(public_text(child) for child in node.children)


def public_walk(node):
    if excluded(node):
        return
    yield node
    for child in node.children:
        if isinstance(child, Element):
            yield from public_walk(child)


def load_text_asset(url, source_dir, root_dir):
    """Inline the same local text the slide runtime fetches, within public trees."""
    if source_dir is None or root_dir is None:
        raise ValueError("data-skill-src requires the deck and repository directories")
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError(f"reading edition requires a local data-skill-src: {url}")
    root, directory = Path(root_dir).resolve(), Path(source_dir).resolve()
    asset = (directory / unquote(parsed.path)).resolve()
    public_roots = (directory, root / "shared")
    if not asset.is_relative_to(root) or not any(asset.is_relative_to(public) for public in public_roots) or any(
            part.startswith((".", "_")) for part in asset.relative_to(root).parts) or is_excluded(asset.relative_to(root)):
        raise ValueError(f"data-skill-src is outside public asset directories: {url}")
    if asset.suffix.lower() not in {".md", ".txt", ".json", ".py", ".js", ".css", ".html", ".xml", ".yaml", ".yml", ".csv", ".tsv", ".toml"}:
        raise ValueError(f"data-skill-src is not a text asset: {url}")
    try:
        return asset.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise ValueError(f"cannot read data-skill-src {url}: {exc}") from exc


def public_slides(source):
    counts = {"aside": 0, "attr": 0, "note": 0, "plugin": 0}
    tree = Tree(strip_html_notes(source, counts))
    container = next((node for node in walk(tree.root) if "slides" in node.classes), None)
    if container is None:
        raise ValueError("reading edition requires a .slides container")
    slides = []
    horizontal = 0
    for section in container.children:
        if not isinstance(section, Element) or section.tag != "section" or excluded(section):
            continue
        children = [child for child in section.children if isinstance(child, Element) and child.tag == "section"]
        vertical = [child for child in children if not excluded(child)]
        if children and not vertical:
            continue
        if children:
            slides.extend((child, f"{horizontal}/{index}") for index, child in enumerate(vertical))
        else:
            slides.append((section, str(horizontal)))
        horizontal += 1
    return slides


def safe_url(value):
    """Keep authored relative/http links; never copy executable URL schemes."""
    return value if value and urlsplit(value).scheme.lower() in {"", "http", "https", "mailto", "tel"} else None


def render_reader(source, talk, site, *, source_dir=None, root_dir=None):
    """Return (complete document, number of public slides)."""
    slides = public_slides(source)
    french = talk.language.startswith("fr")
    labels = ({"read": "Lecture", "slides": "Diapositives", "contents": "Sommaire", "slide": "Diapositive", "open": "Ouvrir la ressource interactive", "back": "Toutes les présentations", "top": "Haut de page", "skip": "Aller au contenu"}
              if french else {"read": "Reading edition", "slides": "Slides", "contents": "Contents", "slide": "Slide", "open": "Open interactive resource", "back": "All talks", "top": "Back to top", "skip": "Skip to content"})
    anchors = ["slide-" + (node.attrs.get("id") or str(index)) for index, (node, _) in enumerate(slides, 1)]
    ids = {node.attrs["id"]: f"{anchor}--{node.attrs['id']}"
           for (slide, _), anchor in zip(slides, anchors) for node in public_walk(slide) if node.attrs.get("id")}
    for (slide, _), anchor in zip(slides, anchors):
        if slide.attrs.get("id"):
            ids[slide.attrs["id"]] = anchor
    headings = [next((child for child in public_walk(slide) if child.tag in {"h1", "h2"}), None) for slide, _ in slides]
    # Resolve all heading targets before rendering: a citation may point to a
    # heading on a later slide, whose reader outline uses a normalized ID.
    for heading, anchor in zip(headings, anchors):
        if heading and heading.attrs.get("id"):
            ids[heading.attrs["id"]] = anchor + "-title"

    def render(node, main_heading=None, heading_id=None, inside_link=False):
        if isinstance(node, str):
            return escape(node)
        if excluded(node):
            return ""
        if node.tag == "iframe":
            url = safe_url(node.attrs.get("data-src") or node.attrs.get("src"))
            title = node.attrs.get("title") or labels["open"]
            return (f'<p class="reader-interactive"><a href="{escape(url, quote=True)}">{escape(labels["open"])}: {escape(title)}</a></p>' if url else "")
        text_src = node.attrs.get("data-embed-src") or node.attrs.get("data-skill-src")
        if text_src:
            text = load_text_asset(text_src, source_dir, root_dir)
            attribution = safe_url(node.attrs.get("data-source-url"))
            code_label = "Texte source" if french else "Source text"
            content = f'<pre tabindex="0" role="region" aria-label="{code_label}"><code>{escape(text)}</code></pre>'
            if attribution:
                content += f'<p class="source"><a href="{escape(attribution, quote=True)}">{escape(attribution)}</a></p>'
            return content
        content = "".join(render(child, main_heading, heading_id, inside_link or node.tag == "a") for child in node.children)
        if node.tag not in TAGS:
            return content
        tag = "h2" if node is main_heading or node.tag == "h1" else node.tag
        attrs = {key: value for key, value in node.attrs.items() if key in ATTRS}
        if node.tag == "pre":
            attrs.update(tabindex="0", role="region", **{"aria-label": "Texte source" if french else "Source text"})
        if node.attrs.get("id"):
            attrs["id"] = ids[node.attrs["id"]]
        if node is main_heading:
            attrs["id"] = heading_id
        if node.tag == "a":
            href = node.attrs.get("href") or node.attrs.get("data-preview-link")
            if href and href.startswith("#/"):
                href = "index.html" + href
            elif href and href.startswith("#") and href[1:] in ids:
                href = "#" + ids[href[1:]]
            if safe_url(href):
                attrs["href"] = href
        if node.tag == "img":
            src = safe_url(node.attrs.get("data-src") or node.attrs.get("src"))
            if not src:
                return ""
            attrs.update(src=src, loading="lazy", decoding="async")
        serialized = "".join(f' {key}' if value is None else f' {key}="{escape(str(value), quote=True)}"' for key, value in attrs.items())
        result = f"<{tag}{serialized}>" + ("" if tag in VOID else content + f"</{tag}>")
        if node.tag == "img" and attrs.get("alt") and not inside_link and not any(
                "logo" in name or name == "mcp-mark" for name in node.classes):
            result = f'<a class="reader-image" href="{escape(attrs["src"], quote=True)}">{result}</a>'
        if node.tag == "table":
            result = f'<div class="reader-table" role="region" aria-label="Table" tabindex="0">{result}</div>'
        return result

    articles, contents = [], []
    for index, ((slide, position), anchor) in enumerate(zip(slides, anchors), 1):
        heading = headings[index - 1]
        title = " ".join(public_text(heading).split()) if heading else (slide.attrs.get("data-toc") or f'{labels["slide"]} {index}')
        heading_id = anchor + "-title"
        content = "".join(render(child, heading, heading_id) for child in slide.children)
        if heading is None:
            content = f'<h2 id="{escape(heading_id)}" class="reader-fallback-title">{escape(title)}</h2>' + content
        source_hash = slide.attrs.get("id") or position
        articles.append(f'''<section class="reader-slide" id="{escape(anchor)}" aria-labelledby="{escape(heading_id)}">
<p class="reader-folio"><a href="index.html#/{escape(source_hash, quote=True)}">{labels['slide']} {index}</a></p>
{content.strip()}
</section>''')
        contents.append(f'<li><a href="#{escape(anchor)}">{escape(title)}</a></li>')
    canonical = talk.canonical_url(site) + "read.html"
    pdf = talk.optional.get("pdf", "slides.pdf")
    if "pdf" in talk.optional and not urlsplit(pdf).scheme:
        pdf = "../../" + pdf.lstrip("/")
    duration = getattr(talk, "duration_minutes", None)
    metadata = f"{len(slides)} {labels['slides'].lower()}" + (f" · {duration} min" if duration else "")
    result = f'''<!DOCTYPE html>
<html lang="{escape(talk.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(talk.title)} — {labels['read']}</title>
  <meta name="description" content="{escape(talk.description, quote=True)}">
{chr(10).join(render_citation(talk, site))}
  <link rel="canonical" href="{escape(canonical, quote=True)}">
  <link rel="icon" href="../../shared/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../../shared/fonts/fonts.css">
  <link rel="stylesheet" href="../../shared/reader.css">
</head>
<body id="top">
  <a class="reader-skip" href="#content">{labels['skip']}</a>
  <header class="reader-header">
    <nav aria-label="Navigation"><a href="../../index.html">{labels['back']}</a><a href="index.html">{labels['slides']}</a><a href="{escape(pdf, quote=True)}">PDF</a></nav>
    <p class="reader-label">{labels['read']}</p>
    <h1>{escape(talk.display_title)}</h1>
    <p class="reader-byline">{escape(' · '.join(talk.presenters))}</p>
    <p>{escape(talk.venue)}</p>
    <p class="reader-meta">{metadata}</p>
  </header>
  <main id="content">
    <details class="reader-contents"><summary>{labels['contents']}</summary><nav aria-label="{labels['contents']}"><ol>{''.join(contents)}</ol></nav></details>
    {chr(10).join(articles)}
  </main>
  <footer class="reader-footer"><a href="#top">{labels['top']}</a> · <a href="index.html">{labels['slides']}</a> · <a href="../../index.html">{labels['back']}</a></footer>
</body>
</html>
'''
    return result, len(slides)
