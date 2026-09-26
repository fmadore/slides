"""Render and synchronise the machine-owned metadata in a talk deck."""
from __future__ import annotations

import html
import json
import re
from urllib.parse import urlparse

from .manifest import Talk

HEAD_START = "  <!-- DECK_META:START (generated from talks/talks.json) -->"
HEAD_END = "  <!-- DECK_META:END -->"
CONFIG_START = "    // DECK_CONFIG_META:START (generated from talks/talks.json)"
CONFIG_END = "    // DECK_CONFIG_META:END"


def _esc(value: str) -> str:
    return html.escape(value, quote=True)


def _json_script(value) -> str:
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")


# The site's owner and publisher. Co-presenters are named from the manifest
# alone; the owner's record also carries the identifiers a citation manager or
# a knowledge graph can resolve the owner by.
OWNER = {
    "name": "Frédérick Madore",
    "url": "https://www.frederickmadore.com/",
    "orcid": "https://orcid.org/0000-0003-0959-2092",
}


def _person(name: str) -> dict:
    person = {"@type": "Person", "name": name}
    if name == OWNER["name"]:
        person.update(url=OWNER["url"], sameAs=OWNER["orcid"])
    return person


def pdf_url(talk: Talk, site: str) -> str:
    """Absolute URL of the talk's PDF: the manifest's `pdf` override, resolved
    against the site root as the landing page resolves it, else the
    slides.pdf the deploy generates beside the deck."""
    override = talk.optional.get("pdf")
    if override:
        if urlparse(override).scheme in {"http", "https"}:
            return override
        return f"{site.rstrip('/')}/{override.lstrip('/')}"
    return talk.canonical_url(site) + "slides.pdf"


def render_citation(talk: Talk, site: str) -> list[str]:
    """Highwire Press tags, which Zotero's connector and Google Scholar read.

    citation_conference_title is what makes Zotero file a talk as a conference
    paper named for its event — with citation_title alone it guesses "journal
    article" — and citation_pdf_url attaches the exported slides in place of a
    snapshot of a page that needs JavaScript to show anything.
    """
    lines = [f'  <meta name="citation_title" content="{_esc(talk.display_title)}">']
    lines += [f'  <meta name="citation_author" content="{_esc(name)}">' for name in talk.presenters]
    lines += [
        f'  <meta name="citation_publication_date" content="{talk.date.replace("-", "/")}">',
        f'  <meta name="citation_conference_title" content="{_esc(talk.event)}">',
        f'  <meta name="citation_language" content="{_esc(talk.language)}">',
        f'  <meta name="citation_pdf_url" content="{_esc(pdf_url(talk, site))}">',
    ]
    lines += [f'  <meta name="citation_keywords" content="{_esc(tag)}">' for tag in talk.tags]
    return lines


def render_head(talk: Talk, site: str) -> str:
    url = talk.canonical_url(site)
    locale = "fr_FR" if talk.language.startswith("fr") else "en_US"
    author_label = talk.presenters[0] if len(talk.presenters) == 1 else " & ".join(
        presenter.rsplit(" ", 1)[-1] for presenter in talk.presenters
    )
    authors = [_person(presenter) for presenter in talk.presenters]
    # The card is a capture of the cover slide (tools/export-pdf.mjs).
    # A colon rather than quotation marks: titles carry quotes of their own.
    cover_alt = (f"Diapositive de couverture : {talk.display_title}"
                 if talk.language.startswith("fr")
                 else f"Cover slide: {talk.display_title}")
    event = {"@type": "Event", "name": talk.event, "startDate": talk.date}
    if talk.optional.get("eventUrl"):
        event["url"] = talk.optional["eventUrl"]
    structured = {
        "@context": "https://schema.org",
        "@type": "PresentationDigitalDocument",
        "name": talk.title,
        "description": talk.description,
        "url": url,
        "inLanguage": talk.language,
        "datePublished": talk.date,
        "author": authors,
        "keywords": ", ".join(talk.tags),
        "image": f"{url}social-card.png",
        "encoding": {
            "@type": "MediaObject",
            "contentUrl": pdf_url(talk, site),
            "encodingFormat": "application/pdf",
        },
        "publisher": _person(OWNER["name"]),
        "releasedEvent": event,
    }
    return "\n".join([
        HEAD_START,
        f"  <title>{_esc(talk.title)} — {_esc(author_label)}</title>",
        f'  <meta name="description" content="{_esc(talk.description)}">',
        f'  <link rel="canonical" href="{_esc(url)}">',
        '  <meta property="og:type" content="article">',
        '  <meta property="og:site_name" content="Slides — Frédérick Madore">',
        f'  <meta property="og:title" content="{_esc(talk.title)}">',
        f'  <meta property="og:description" content="{_esc(talk.description)}">',
        f'  <meta property="og:url" content="{_esc(url)}">',
        f'  <meta property="og:image" content="{_esc(url)}social-card.png">',
        '  <meta property="og:image:width" content="1280">',
        '  <meta property="og:image:height" content="720">',
        f'  <meta property="og:image:alt" content="{_esc(cover_alt)}">',
        f'  <meta property="og:locale" content="{locale}">',
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <script type="application/ld+json">{_json_script(structured)}</script>',
        f'  <meta name="author" content="{_esc(", ".join(talk.presenters))}">',
        *render_citation(talk, site),
        HEAD_END,
    ])


def render_config(talk: Talk) -> str:
    toc = "Sommaire" if talk.language.startswith("fr") else "Outline"
    values = [
        ("presenter", " · ".join(talk.presenters)),
        ("talkTitle", talk.display_title),
        ("talkShort", talk.short_title),
        ("venue", talk.venue),
        ("tocEyebrow", toc),
    ]
    lines = [CONFIG_START]
    for key, value in values:
        pad = " " * max(1, 10 - len(key))
        lines.append(f"    {key}:{pad}{_json_script(value)},")
    lines.append(CONFIG_END)
    return "\n".join(lines)


def _replace_head(source: str, rendered: str, adopt_legacy: bool) -> str:
    if HEAD_START in source and HEAD_END in source:
        pattern = re.escape(HEAD_START) + r".*?" + re.escape(HEAD_END)
        return re.sub(pattern, lambda _: rendered, source, count=1, flags=re.DOTALL)
    if not adopt_legacy:
        raise ValueError("generated DECK_META markers missing")
    start = source.find("  <title>")
    icon = source.find('  <link rel="icon"', start)
    if start < 0 or icon < 0:
        raise ValueError("could not locate the legacy <head> metadata block")
    return source[:start] + rendered + "\n" + source[icon:]


def _replace_config(source: str, rendered: str, adopt_legacy: bool) -> str:
    if CONFIG_START in source and CONFIG_END in source:
        pattern = re.escape(CONFIG_START) + r".*?" + re.escape(CONFIG_END)
        return re.sub(pattern, lambda _: rendered, source, count=1, flags=re.DOTALL)
    if not adopt_legacy:
        raise ValueError("generated DECK_CONFIG_META markers missing")
    match = re.search(
        r"(?P<open>^[ \t]*window\.DECK_CONFIG\s*=\s*\{\s*\n)"
        r"(?P<meta>.*?)"
        r"(?P<rest>^[ \t]*transition\s*:)",
        source,
        flags=re.MULTILINE | re.DOTALL,
    )
    if not match:
        raise ValueError("could not locate the legacy DECK_CONFIG metadata fields")
    return source[:match.start("meta")] + rendered + "\n" + source[match.start("rest"):]


def sync_deck_html(source: str, talk: Talk, site: str, *, adopt_legacy: bool = False) -> str:
    source = re.sub(
        r"<html\s+lang=(['\"]).*?\1>",
        f'<html lang="{_esc(talk.language)}">',
        source,
        count=1,
        flags=re.IGNORECASE,
    )
    source = _replace_head(source, render_head(talk, site), adopt_legacy)
    return _replace_config(source, render_config(talk), adopt_legacy)
