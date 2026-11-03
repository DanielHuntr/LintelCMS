# Fonts

- `font-catalogue.ts`: the 23 open-licence families that come with Lintel. Their Latin WOFF2
  files and licences are in `packages/builder-model/fonts/`, fetched from the `@fontsource`
  packages by `scripts/fetch-fonts.mjs`; the website serves them from `/_lintel/fonts/`.
- `page-fonts.ts`: the fonts a page adds (the page element's `fonts` prop), from the
  catalogue or uploaded to the media library, and the `@font-face` rules and preloads
  they become. Every face uses `font-display: swap`.
- `site-fonts.ts`: fonts kept for a whole site (uploaded, from Google Fonts or from an Adobe
  Fonts project; stored by core's `src/site-fonts`), as CSS: `compileSiteFontFaces`,
  `compileIncludedFontFaces` (every catalogue font, declared once for the site), Adobe's
  stylesheet address, and `guessFontFromFileName` for uploads that don't name themselves.

To add a family, add it to both lists (the script's and the catalogue's) and run the script.
