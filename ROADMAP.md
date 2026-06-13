# Roadmap

Planned, not yet done.

## Custom subdomain — slides.frederickmadore.com

The site currently lives at **https://fmadore.github.io/slides/**. To move it to the
subdomain later:

1. At the DNS provider for `frederickmadore.com`, add a record:

   | Type  | Name     | Value              |
   |-------|----------|--------------------|
   | CNAME | `slides` | `fmadore.github.io` |

2. Re-create a `CNAME` file at the repo root containing one line:

   ```
   slides.frederickmadore.com
   ```

   (or set it under **Settings → Pages → Custom domain**, which writes the file for you).
3. Wait for DNS to propagate, then tick **Enforce HTTPS** in Settings → Pages once the
   certificate is issued.

All asset paths are relative, so no code changes are needed — the deck works at both the
`/slides/` project path and the subdomain root.

## Ideas (optional)

- Link `slides.frederickmadore.com` from the main site's navigation.
- GitHub Actions check on push (HTML / dead-link validation).
- Per-talk Open Graph image for nicer social-media previews.
