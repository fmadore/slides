#!/usr/bin/env python3
"""Scaffold a new talk from the minimal starter.

    python3 tools/new-talk.py \
      --date 2026-09-01 \
      --place bayreuth \
      --title "My talk" \
      --venue "Conference · Bayreuth" \
      --lang en

It generates a safe dated slug, copies talks/_template, fills the title /
venue / date / language / presenter metadata into DECK_CONFIG and the cover,
registers the talk in talks/talks.json, regenerates the landing page
(tools/build-index.py) and writes assets/qr-slides.png pointing at the final
canonical URL. It refuses to overwrite an existing deck.

The QR code needs the `qrcode` package (pip install "qrcode[pil]"); without
it everything else still happens and the placeholder QR is kept, with a
reminder printed.
"""
import argparse
import datetime
import html as html_mod
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "talks" / "_template"
MANIFEST = ROOT / "talks" / "talks.json"


def entry_tags(args):
    return [t.strip() for t in args.tags.split(",") if t.strip()]


def slugify(text, max_words=5):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    words = re.findall(r"[a-z0-9]+", text.lower())
    return "-".join(words[:max_words])


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
    args = ap.parse_args(argv)

    try:
        datetime.date.fromisoformat(args.date)
    except ValueError:
        sys.exit(f"error: --date {args.date!r} is not a valid YYYY-MM-DD date")

    slug = f"{args.date}-{slugify(args.place, 2)}-{slugify(args.title)}"
    dest = ROOT / "talks" / slug
    if dest.exists():
        sys.exit(f"error: talks/{slug} already exists — refusing to overwrite it")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    site = manifest.get("site", "https://slides.frederickmadore.com").rstrip("/")
    url = f"{site}/talks/{slug}/"
    presenters = [p.strip() for p in args.presenters.split(",") if p.strip()]
    short = args.short_title or args.title
    venue = args.venue or f"{args.event or 'Venue'} · {args.date}"
    event = args.event or args.venue or "Event"
    toc_eyebrow = {"en": "Outline", "fr": "Sommaire"}[args.lang]

    # 1 — copy the minimal starter
    shutil.copytree(TEMPLATE, dest)

    # 2 — populate the deck's metadata
    deck = dest / "index.html"
    html = deck.read_text(encoding="utf-8")
    year, month, day = args.date.split("-")
    nice_date = datetime.date.fromisoformat(args.date).strftime("%-d %B %Y") \
        if sys.platform != "win32" else args.date
    replacements = {
        '<html lang="en">': f'<html lang="{args.lang}">',
        "<title>Talk title — Frédérick Madore</title>":
            f"<title>{args.title} — {presenters[0]}</title>",
        '<meta name="description" content="A one-line description of the talk.">':
            f'<meta name="description" content="{args.desc or args.title}">',
        'talkTitle: "Talk title"': f'talkTitle: {json.dumps(args.title, ensure_ascii=False)}',
        'talkShort: "Talk title"': f'talkShort: {json.dumps(short, ensure_ascii=False)}',
        'venue:     "Venue · DD Month YYYY"': f'venue:     {json.dumps(venue, ensure_ascii=False)}',
        'tocEyebrow:"Outline"': f'tocEyebrow:{json.dumps(toc_eyebrow, ensure_ascii=False)}',
        'presenter: "Frédérick Madore"': f'presenter: {json.dumps(" · ".join(presenters), ensure_ascii=False)}',
        "<p class=\"eyebrow\">Event · Place, DD Month YYYY</p>":
            f'<p class="eyebrow">{event} · {nice_date}</p>',
        "<h1>Talk title</h1>": f"<h1>{args.title}</h1>",
        '<p class="subtitle">A one-line description of the talk.</p>':
            f'<p class="subtitle">{args.desc or "A one-line description of the talk."}</p>',
    }
    for old, new in replacements.items():
        html = html.replace(old, new)

    # canonical URL, Open Graph and structured metadata (mirrors the published decks)
    def esc(s):
        return html_mod.escape(s, quote=True)
    desc = args.desc or args.title
    ld = {
        "@context": "https://schema.org",
        "@type": "PresentationDigitalDocument",
        "name": args.title, "description": desc, "url": url,
        "inLanguage": args.lang, "datePublished": args.date,
        "author": [{"@type": "Person", "name": p} for p in presenters],
        "keywords": ", ".join(entry_tags(args)),
        "publisher": {"@type": "Person", "name": "Frédérick Madore",
                      "url": "https://www.frederickmadore.com/"},
        "releasedEvent": {"@type": "Event", "name": event, "startDate": args.date},
    }
    meta_block = f'''  <link rel="canonical" href="{url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Slides — Frédérick Madore">
  <meta property="og:title" content="{esc(args.title)}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{url}social-card.png">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:locale" content="{'fr_FR' if args.lang == 'fr' else 'en_US'}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
'''
    m = re.search(r"^.*<title>.*</title>.*$\n", html, re.M)
    html = html[:m.end()] + meta_block + html[m.end():]
    deck.write_text(html, encoding="utf-8")

    # 3 — register in the manifest (newest first) and rebuild the landing page
    entry = {
        "slug": slug, "date": args.date, "language": args.lang,
        "event": event, "venue": venue, "title": args.title, "shortTitle": short,
        "description": args.desc or args.title, "presenters": presenters,
        "tags": entry_tags(args),
    }
    manifest["talks"].insert(0, entry)
    manifest["talks"].sort(key=lambda t: t["date"], reverse=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    subprocess.run([sys.executable, str(ROOT / "tools" / "build-index.py")], check=True)

    # 4 — QR code to the canonical URL (optional dependency)
    qr_note = ""
    try:
        import qrcode
        from qrcode.constants import ERROR_CORRECT_M
        qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=12, border=2)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(dest / "assets" / "qr-slides.png")
        qr_note = f"QR code written: talks/{slug}/assets/qr-slides.png → {url}"
    except ImportError:
        qr_note = ('qrcode package not installed — the placeholder QR was kept.\n'
                   '  Fix:  pip install "qrcode[pil]"  then re-run only the QR step, e.g.\n'
                   f'  python3 -c "import qrcode; qrcode.make({url!r}).save('
                   f'\'talks/{slug}/assets/qr-slides.png\')"')

    print(f"""
created talks/{slug}/
  registered in talks/talks.json and the landing page was regenerated
  {qr_note}

next steps:
  1. Edit talks/{slug}/index.html — the slides and speaker notes.
  2. Preview:  python3 serve-deck.py   →  http://localhost:8742/talks/{slug}/
     (append ?check to see auto-fit / overflow diagnostics)
  3. Validate: python3 tools/audit.py
  4. Commit and push — the Pages workflow publishes {url}
""")


if __name__ == "__main__":
    main()
