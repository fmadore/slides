#!/usr/bin/env python3
"""Scaffold a new talk from the minimal starter.

    python3 tools/new-talk.py \
      --date 2026-09-01 \
      --place bayreuth \
      --title "My talk" \
      --venue "Conference · Bayreuth" \
      --lang en

It validates and stages the complete deck before updating talks/talks.json,
then regenerates the landing page and sitemap. By default it also writes an
assets/qr-slides.png pointing at the canonical URL. Use --dry-run to validate
without changing the repository or --no-qr to omit the QR markup and asset.
"""
import argparse
import datetime
import html as html_mod
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from slideslib.deck_metadata import sync_deck_html
from slideslib.manifest import Talk, atomic_write, load_manifest, manifest_text

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "talks" / "_template"
MANIFEST = ROOT / "talks" / "talks.json"


def entry_tags(args):
    return [t.strip() for t in args.tags.split(",") if t.strip()]


def slugify(text, max_words=5):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    words = re.findall(r"[a-z0-9]+", text.lower())
    return "-".join(words[:max_words])


MONTHS = {
    "en": ("January", "February", "March", "April", "May", "June",
           "July", "August", "September", "October", "November", "December"),
    "fr": ("janvier", "février", "mars", "avril", "mai", "juin",
           "juillet", "août", "septembre", "octobre", "novembre", "décembre"),
}


def format_human_date(value, language):
    month = MONTHS.get(language, MONTHS["en"])[value.month - 1]
    return f"{value.day} {month} {value.year}"


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise ValueError(f"template drift: expected one {label}, found {count}")
    return source.replace(old, new, 1)


def omit_qr_markup(source):
    return re.sub(
        r"\n[ \t]*(?:<!--[^\n]*QR[^\n]*-->\s*)?"
        r"<div class=\"slides-qr[^\"]*\">.*?</div>",
        "",
        source,
        flags=re.DOTALL,
    )


def write_qr(path, url):
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M

    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=12, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr.make_image(fill_color="black", back_color="white").save(path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--date", required=True, help="YYYY-MM-DD")
    ap.add_argument("--place", required=True, help="city, used in the slug (e.g. bayreuth)")
    ap.add_argument("--title", required=True)
    ap.add_argument("--venue", default="", help='footer line, e.g. "Conference · City · 1 Sept 2026"')
    ap.add_argument("--lang", default="en", choices=["en", "fr"])
    ap.add_argument("--event", default="", help='landing-page event line, e.g. "Conference · City"')
    ap.add_argument("--short-title", default="", help="footer label (defaults to --title)")
    ap.add_argument("--desc", default="", help="one-line description for the landing page")
    ap.add_argument("--presenters", default="Frédérick Madore",
                    help='comma-separated, e.g. "A. Author, B. Author"')
    ap.add_argument("--tags", default="", help="comma-separated subject tags")
    ap.add_argument("--no-qr", action="store_true",
                    help="omit QR markup and do not require qrcode[pil]")
    ap.add_argument("--dry-run", action="store_true",
                    help="validate and stage the deck without changing the repository")
    args = ap.parse_args(argv)

    try:
        talk_date = datetime.date.fromisoformat(args.date)
    except ValueError:
        ap.error(f"--date {args.date!r} is not a valid YYYY-MM-DD date")

    place_slug = slugify(args.place, 2)
    title_slug = slugify(args.title)
    if not place_slug:
        ap.error("--place must contain at least one letter or number")
    if not title_slug:
        ap.error("--title must contain at least one letter or number")
    presenters = tuple(p.strip() for p in args.presenters.split(",") if p.strip())
    if not presenters:
        ap.error("--presenters must contain at least one name")

    slug = f"{args.date}-{place_slug}-{title_slug}"
    dest = ROOT / "talks" / slug
    if dest.exists():
        ap.error(f"talks/{slug} already exists — refusing to overwrite it")

    manifest = load_manifest(MANIFEST)
    if any(item.slug == slug for item in manifest.talks):
        ap.error(f"talks/talks.json already contains {slug!r}")

    short = args.short_title or args.title
    venue = args.venue or f"{args.event or 'Venue'} · {args.date}"
    event = args.event or args.venue or "Event"
    desc = args.desc or args.title
    talk = Talk(
        slug=slug,
        date=args.date,
        language=args.lang,
        event=event,
        venue=venue,
        title=args.title,
        short_title=short,
        description=desc,
        presenters=presenters,
        tags=tuple(entry_tags(args)),
    )
    url = talk.canonical_url(manifest.site)

    if not args.no_qr:
        try:
            import qrcode  # noqa: F401 — fail before any repository mutation
        except ImportError:
            ap.error(
                "QR generation requires qrcode[pil]; run "
                f"{sys.executable} -m pip install -r requirements-dev.txt, or use --no-qr"
            )

    with tempfile.TemporaryDirectory(prefix=f".{slug}-", dir=ROOT / "talks") as temporary:
        staged = Path(temporary) / slug
        shutil.copytree(TEMPLATE, staged)
        deck = staged / "index.html"
        source = deck.read_text(encoding="utf-8")
        escaped_event = html_mod.escape(event, quote=False)
        escaped_title = html_mod.escape(args.title, quote=False)
        escaped_desc = html_mod.escape(desc, quote=False)
        escaped_presenter = html_mod.escape(presenters[0], quote=False)
        source = replace_once(
            source,
            '<p class="eyebrow">Event · Place, DD Month YYYY</p>',
            f'<p class="eyebrow">{escaped_event} · {format_human_date(talk_date, args.lang)}</p>',
            "cover event line",
        )
        source = replace_once(source, "<h1>Talk title</h1>", f"<h1>{escaped_title}</h1>", "cover title")
        source = replace_once(
            source,
            '<p class="subtitle">A one-line description of the talk.</p>',
            f'<p class="subtitle">{escaped_desc}</p>',
            "cover description",
        )
        source = replace_once(
            source,
            '      <div class="byline">\n        <span class="name">Frédérick Madore</span>',
            f'      <div class="byline">\n        <span class="name">{escaped_presenter}</span>',
            "cover presenter",
        )
        source = sync_deck_html(source, talk, manifest.site)
        if args.no_qr:
            source = omit_qr_markup(source)
            (staged / "assets" / "qr-slides.png").unlink(missing_ok=True)
        else:
            write_qr(staged / "assets" / "qr-slides.png", url)
        deck.write_text(source, encoding="utf-8", newline="\n")

        if args.dry_run:
            print(f"validated talks/{slug}/ (dry run; no files changed)\n  canonical URL: {url}")
            return 0

        updated_manifest = manifest.with_talk(talk)
        generated = (
            ROOT / "index.html",
            ROOT / "sitemap.xml",
            *(ROOT / "talks" / item.slug / "index.html" for item in manifest.talks),
        )
        backups = {
            path: path.read_text(encoding="utf-8") if path.exists() else None
            for path in (MANIFEST, *generated)
        }
        moved = False
        try:
            staged.replace(dest)
            moved = True
            atomic_write(MANIFEST, manifest_text(updated_manifest))
            subprocess.run(
                [sys.executable, str(ROOT / "tools" / "build-index.py")],
                cwd=ROOT,
                check=True,
            )
        except BaseException:
            for path, backup in backups.items():
                if backup is None:
                    path.unlink(missing_ok=True)
                else:
                    atomic_write(path, backup)
            if moved and dest.exists():
                shutil.rmtree(dest)
            raise

    qr_note = (
        "QR markup and asset omitted (--no-qr)"
        if args.no_qr else
        f"QR code written: talks/{slug}/assets/qr-slides.png → {url}"
    )

    print(f"""
created talks/{slug}/
  registered in talks/talks.json and the landing page was regenerated
  {qr_note}

next steps:
  1. Edit talks/{slug}/index.html — the slides and speaker notes.
  2. Preview:  python3 serve-deck.py   →  http://localhost:8742/talks/{slug}/
     (append ?check to see auto-fit / overflow diagnostics)
  3. Validate: npm test && python3 tools/audit.py --strict
  4. Commit and push — the Pages workflow publishes {url}
""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
