# Site fonts (admin)

Settings → Site → Fonts (`/settings/site/fonts`): the fonts every page of the current site
can use. The server side is `packages/core/src/site-fonts`.

- `SiteFontsPage.tsx`: the screen. `SiteFontsManager.tsx` lists the fonts, each previewed in
  itself, with where it came from and its weights, and the Adobe Fonts projects.
- `AddFontDialog.tsx`: "Add a font", in three tabs:
  - `GoogleFontsTab.tsx`: search the whole Google Fonts library by name and kind, preview,
    pick weights (regular and bold to start) and add. Lintel downloads the files.
  - `UploadFontsTab.tsx`: drop or choose several files at once. Each is uploaded to the media
    library, then `POST /site-fonts/inspect` reads its family, weight and style (or guesses
    from the file name). Everything can be changed, and one tick confirms the licence.
  - `AdobeFontsTab.tsx`: paste a web project ID; one line says Adobe serves the fonts and
    the site's address must be added to the project.
- `ThemeFontChoice.tsx`: in Settings → Site's theme, a font for headings and for body text in
  place of the pairing's, with a link to the fonts.
- `useBuilderFonts.tsx`: what the page builder gets: "Add a font" opens the same dialog, and
  a font uploaded to one page can become a site font after a licence question.
- `siteFonts.queries.ts`: the list, the changes (which also refresh the builder's canvas), and
  `useFontPreview`, which loads a font file and names it for this page only.
- `describeFontError.ts`: the font services' own messages ("Lintel couldn't reach Google
  Fonts just now…") are shown as they are.

Previews never ask another service from the browser: Google Fonts previews come through
Lintel's API, and site fonts' files from the media library. The admin's
Content-Security-Policy allows fonts from the API, and Adobe's stylesheet and files, for the
builder's canvas.
