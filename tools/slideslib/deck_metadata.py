"""Render and synchronise the machine-owned metadata in a talk deck."""
from __future__ import annotations

import html
import json
import re

from .manifest import Talk

HEAD_START = "  <!-- DECK_META:START (generated from talks/talks.json) -->"
HEAD_END = "  <!-- DECK_META:END -->"
CONFIG_START = "    // DECK_CONFIG_META:START (generated from talks/talks.json)"
CONFIG_END = "    // DECK_CONFIG_META:END"


def _esc(value: str) -> str:
    return html.escape(value, quote=True)


def _json_script(value) -> str:
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")


def render_head(talk: Talk, site: str) -> str:
    url = talk.canonical_url(site)
    locale = "fr_FR" if talk.language.startswith("fr") else "en_US"
    author_label = talk.presenters[0] if len(talk.presenters) == 1 else " & ".join(
        presenter.rsplit(" ", 1)[-1] for presenter in talk.presenters
    )
    authors = [{"@type": "Person", "name": presenter} for presenter in talk.presenters]
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
        "publisher": {
            "@type": "Person",
            "name": "Frédérick Madore",
            "url": "https://www.frederickmadore.com/",
        },
        "releasedEvent": {
            "@type": "Event",
            "name": talk.event,
            "startDate": talk.date,
        },
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
        f'  <meta property="og:locale" content="{locale}">',
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <script type="application/ld+json">{_json_script(structured)}</script>',
        f'  <meta name="author" content="{_esc(", ".join(talk.presenters))}">',
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
