# Site fonts

The fonts a whole site can use, kept once per site (`site_fonts`, one row per family) rather
than on each page. Every page, the page builder's font list and the theme's heading and
body choices can use them. Why it works this way: `docs/decisions/0037-site-fonts.md`.

Three kinds, by `source`:

- **`upload`**: font files the maker uploaded to the media library (WOFF2, TTF, OTF), one
  per weight and style. Adding them needs `licenceConfirmed: true`; who confirmed, and when,
  is kept on the row.
- **`google`**: a Google Fonts family. Lintel downloads its WOFF2 files into the media
  library and the website serves them itself, so visitors' browsers never contact Google.
- **`adobe`**: a family from an Adobe Fonts web project. Adobe serves the files; the website
  links to the project's stylesheet on every page, as Adobe's licence asks.

The 23 fonts that come with Lintel (`@lintel/builder-model`'s font catalogue) aren't rows:
every site has them, always.

## Files

- `site-fonts.routes.ts`: HTTP only (the list of routes is at the top).
- `site-fonts.service.ts`: listing, adding uploaded files, reading files' names, removing,
  and `readWebsiteFonts`, what the website draws with.
- `google-fonts.service.ts` and `google-fonts-client.ts`: searching the Google Fonts library,
  previews, and downloading a family.
- `adobe-fonts.service.ts` and `adobe-fonts-client.ts`: connecting a web project.
- `font-network.ts`: every request to another service, to a fixed list of hosts.
- `font-file-names.ts`: reads a font file's family, weight and style from inside it.
- `website-fonts.ts`: the fonts part of the website's stylesheet.
- `site-fonts.repository.ts`, `site-fonts.table.ts`: the `site_fonts` table (migration
  `0032_site_fonts`).

## Where the Google Fonts library comes from

[Fontsource](https://fontsource.org) republishes every Google Fonts family, with its open
licence, as ready-split WOFF2 files, and has a public API that needs no key:

- `https://api.fontsource.org/v1/fonts`: the list (about 2,000 families). Kept a day.
- `https://api.fontsource.org/v1/fonts/<id>`: a family's weights and character ranges.
- `https://cdn.jsdelivr.net/fontsource/fonts/<id>@latest/<alphabet>-<weight>-<style>.woff2`:
  the files. Lintel takes the `latin` and `latin-ext` alphabets of each chosen weight, each
  with its `unicode-range`, so browsers fetch the second only for pages that need it.

Only families Fontsource marks as Google's (`type: "google"`) are listed. The fonts that come
with Lintel were fetched from Fontsource's packages too.

## Safety

- Requests go only to `api.fontsource.org`, `cdn.jsdelivr.net` and `use.typekit.net`, over
  https, with addresses Lintel builds from checked ids. Redirects are refused, so nothing can
  point the server into its own network.
- Each request gives up after 15 seconds. Files are limited to 2 MB, the list to 4 MB and
  Adobe's stylesheet to 512 KB.
- Downloaded files go through the media library's `uploadAsset`, so its file checks apply.
- When a service can't be reached, the API answers `503 FONT_SERVICE_UNREACHABLE` in plain
  words, and says the included fonts still work.

## Permissions

Anyone who can edit pages (`entries:read`) can list the fonts. Changing them is part of the
site's design: `settings:update`, and uploaded files also need `media:upload`.

## On the website

`readWebsiteFonts` gives the site context (`src/website/site-context.service.ts`) each font's
files with their media addresses, and Adobe's stylesheet links. The site stylesheet then has
an `@font-face` rule for every included font and every site font (browsers only download
what a page uses), and, when the theme names a font for headings or body text (the
`headingFont` and `bodyFont` website settings), `--lintel-font-heading` and
`--lintel-font-body` set to it. Adobe's stylesheet is linked in every page's `<head>`, and on
the builder's canvas.

## Removing a font

Removing a Google font deletes the files Lintel downloaded for it, unless another site still
uses them. Uploaded files stay in the media library. Disconnecting an Adobe project removes
all its families.

## Fonts on one page

Before site fonts, a page could upload a font for itself (the page element's `fonts` prop,
see `@lintel/builder-model`'s `page-fonts.ts`). Those still work. The builder's font list
shows them as "This page only", with "Use it on every page", which adds the same files here.
