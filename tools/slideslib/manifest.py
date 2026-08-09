"""Validated talk-manifest model shared by generators and audits."""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

REQUIRED_TEXT = (
    "slug", "date", "language", "event", "venue", "title",
    "shortTitle", "description",
)
OPTIONAL_TEXT = ("deckTitle", "video", "pdf", "eventUrl")
SLUG_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$")
LANG_RE = re.compile(r"^[a-z]{2}(?:-[A-Z]{2})?$")


class ManifestValidationError(ValueError):
    def __init__(self, errors: Iterable[str]):
        self.errors = list(errors)
        super().__init__("; ".join(self.errors))


@dataclass(frozen=True)
class Talk:
    slug: str
    date: str
    language: str
    event: str
    venue: str
    title: str
    short_title: str
    description: str
    presenters: tuple[str, ...]
    tags: tuple[str, ...] = ()
    deck_title: str | None = None
    optional: dict[str, str] = field(default_factory=dict)

    @property
    def display_title(self) -> str:
        return self.deck_title or self.title

    def canonical_url(self, site: str) -> str:
        return f"{site.rstrip('/')}/talks/{self.slug}/"

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "slug": self.slug,
            "date": self.date,
            "language": self.language,
            "event": self.event,
            "venue": self.venue,
            "title": self.title,
            "shortTitle": self.short_title,
            "description": self.description,
            "presenters": list(self.presenters),
            "tags": list(self.tags),
        }
        if self.deck_title:
            value["deckTitle"] = self.deck_title
        value.update(self.optional)
        return value


@dataclass(frozen=True)
class TalkManifest:
    site: str
    talks: tuple[Talk, ...]
    comment: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {}
        if self.comment is not None:
            value["$comment"] = self.comment
        value.update(self.extra)
        value["site"] = self.site
        value["talks"] = [talk.to_dict() for talk in self.talks]
        return value

    def with_talk(self, talk: Talk) -> "TalkManifest":
        talks = sorted((*self.talks, talk), key=lambda item: item.date, reverse=True)
        return TalkManifest(self.site, tuple(talks), self.comment, dict(self.extra))


def _valid_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def parse_manifest(data: Any) -> TalkManifest:
    errors: list[str] = []
    if not isinstance(data, dict):
        raise ManifestValidationError(["manifest root must be a JSON object"])

    site = data.get("site")
    if not isinstance(site, str) or not site.strip():
        errors.append("missing field 'site'")
        site = ""
    elif not _valid_http_url(site):
        errors.append("site must be an absolute http(s) URL")

    rows = data.get("talks")
    if not isinstance(rows, list):
        errors.append("field 'talks' must be a list")
        rows = []

    talks: list[Talk] = []
    raw_slugs: list[str] = []
    for index, raw in enumerate(rows):
        if not isinstance(raw, dict):
            errors.append(f"talk #{index + 1}: entry must be an object")
            continue
        label = raw.get("slug") if isinstance(raw.get("slug"), str) else "?"
        for name in REQUIRED_TEXT:
            if not isinstance(raw.get(name), str) or not raw[name].strip():
                errors.append(f"{label}: missing field {name!r}")

        slug = raw.get("slug", "") if isinstance(raw.get("slug"), str) else ""
        date = raw.get("date", "") if isinstance(raw.get("date"), str) else ""
        language = raw.get("language", "") if isinstance(raw.get("language"), str) else ""
        if slug:
            raw_slugs.append(slug)
            if not SLUG_RE.fullmatch(slug):
                errors.append(f"{label}: slug must be a dated lowercase hyphenated identifier")
        if date:
            try:
                dt.date.fromisoformat(date)
            except ValueError:
                errors.append(f"{label}: date must be a valid YYYY-MM-DD date")
            else:
                if slug and not slug.startswith(date + "-"):
                    errors.append(f"{label}: slug must begin with its date")
        if language and not LANG_RE.fullmatch(language):
            errors.append(f"{label}: language must be a two-letter code")

        presenters = raw.get("presenters")
        if not isinstance(presenters, list) or not presenters or not all(
                isinstance(item, str) and item.strip() for item in presenters):
            errors.append(f"{label}: field 'presenters' must be a non-empty string list")
            presenters = []
        tags = raw.get("tags", [])
        if not isinstance(tags, list) or not all(isinstance(item, str) and item.strip() for item in tags):
            errors.append(f"{label}: field 'tags' must be a string list")
            tags = []

        optional: dict[str, str] = {}
        for name in OPTIONAL_TEXT:
            value = raw.get(name)
            if value is not None and (not isinstance(value, str) or not value.strip()):
                errors.append(f"{label}: optional field {name!r} must be a non-empty string")
            elif name not in {"deckTitle"} and isinstance(value, str):
                optional[name] = value

        if all(isinstance(raw.get(name), str) and raw[name].strip() for name in REQUIRED_TEXT) \
                and presenters:
            talks.append(Talk(
                slug=slug,
                date=date,
                language=language,
                event=raw["event"],
                venue=raw["venue"],
                title=raw["title"],
                short_title=raw["shortTitle"],
                description=raw["description"],
                presenters=tuple(item.strip() for item in presenters),
                tags=tuple(item.strip() for item in tags),
                deck_title=raw.get("deckTitle"),
                optional=optional,
            ))

    if len(raw_slugs) != len(set(raw_slugs)):
        errors.append("duplicate slugs in manifest")
    dates = [talk.date for talk in talks]
    if dates != sorted(dates, reverse=True):
        errors.append("talks must be sorted newest first")
    if errors:
        raise ManifestValidationError(errors)

    extra = {key: value for key, value in data.items() if key not in {"$comment", "site", "talks"}}
    return TalkManifest(site.rstrip("/"), tuple(talks), data.get("$comment"), extra)


def load_manifest(path: str | os.PathLike[str]) -> TalkManifest:
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise ManifestValidationError([f"unreadable manifest: {exc}"]) from exc
    return parse_manifest(data)


def manifest_text(manifest: TalkManifest) -> str:
    return json.dumps(manifest.to_dict(), ensure_ascii=False, indent=2) + "\n"


def atomic_write(path: str | os.PathLike[str], text: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
        os.replace(temporary, target)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
