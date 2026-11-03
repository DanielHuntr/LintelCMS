# 37. Fonts are kept per site: your own files, Google Fonts served by Lintel, and Adobe Fonts

Date: 2026-11-03

## Decision

Each site has one list of fonts (Settings → Site → Fonts, and "Add a font" in the page
builder's font list). Every page and the theme's heading and body choices can use them.
They come from three places:

- **Your own files.** Drop several at once, one per weight and style. Lintel reads each
  file's family, weight and style from inside it (the `name` and `OS/2` tables, in TTF, OTF,
  WOFF or WOFF2), or guesses from the file name, and the maker can change any of it. One
  tick confirms their licence lets them use the font on a website; who ticked it, and when,
  is kept.
- **Google Fonts, the whole library.** Search by name and kind, preview, pick weights.
  Lintel downloads the files on the server into the media library and the website serves
  them itself.
- **Adobe Fonts.** Paste a web project ID. Lintel reads the project's stylesheet once to
  list its families; the website links to that stylesheet on every page.

The 23 fonts that come with Lintel stay available everywhere, without being added: the site
stylesheet declares them all, and browsers download only what a page uses.

## Why self-host Google Fonts

Loading fonts from Google's servers sends every visitor's address to Google. A German court
ruled that this needs consent under the GDPR (LG München, 2022). Every Google Fonts family is
under an open licence (almost all SIL OFL, a few Apache or Ubuntu Font Licence), which allows
copying and serving the files. So Lintel downloads them once and visitors never contact
Google.

## Why Fontsource for the list and the files

- Google's own list (`fonts.google.com/metadata/fonts`) works without a key but is an
  undocumented address, and its files come through a stylesheet API that answers differently
  depending on the browser asking.
- The Google Fonts developer API needs a key, which every install would have to get.
- [Fontsource](https://fontsource.org) is an open-source project (MIT) that republishes every
  Google Fonts family. Its API (`api.fontsource.org/v1/fonts`) needs no key, lists weights,
  styles, kinds and licences, and its files (on jsDelivr) are already split by alphabet as
  WOFF2. The fonts that come with Lintel were fetched from Fontsource too.

Lintel takes the Latin and Latin Extended files of each chosen weight, each with its
`unicode-range`. The list is kept in memory for a day.

## Why Adobe's fonts are not downloaded

Adobe's licence for web projects has the fonts served by Adobe, through the project's
stylesheet, on the domains listed in the project. So Lintel links the stylesheet as Adobe's
embed code does, and the font screen says, in one line, that Adobe serves them and that the
site's address must be added to the project.

## Safety

The server only talks to `api.fontsource.org`, `cdn.jsdelivr.net` and `use.typekit.net`, over
https, at addresses it builds from checked ids (a Google family id, an Adobe project ID of 5
to 12 letters and numbers). Redirects are refused, requests time out after 15 seconds, and
sizes are capped. Downloaded files pass the media library's usual checks. When the server is
offline, the screens say so plainly and the included fonts still work.

## Why per site, and not per page or for the whole install

Pages could already upload a font for themselves, but a brand's fonts belong to the whole
site, and the theme needs to name them. Different sites in one install often have different
brands, so the list is per site, as menus are. Fonts a page uploaded for itself keep working;
the builder offers to move them to the site.

## Not a plugin

Every site has fonts, so this is part of the core rather than an optional feature. Nothing
contacts another service until someone searches Google Fonts or connects an Adobe project.

## Consequences

- New table `site_fonts` (migration `0032_site_fonts`), with `tenantId`.
- The website settings gain `headingFont` and `bodyFont` (family names; empty follows the
  pairing).
- The admin's Content-Security-Policy allows fonts from the API, and Adobe's stylesheet and
  files, so the builder's canvas shows site fonts.
- Google font files appear in the media library, so backups and other storage (S3) include
  them. Removing a Google font deletes the files it downloaded.
- Editors who can change pages but not settings can use the site's fonts but not add new
  ones. Before, they could upload a font to one page; that's no longer offered.
