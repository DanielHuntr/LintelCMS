# Website

Settings for the website Lintel serves itself, and the editor's link to a live page. The
API side is in core's `src/website`.

- `SiteSettingsPage.tsx` is **Settings → Your website** (`/settings/site`): where the site
  is live (with **Open website**), the template, colours, fonts, light or dark, corners,
  spacing, the logo and the site's address. Picking a template brings that template's own
  look; the light or dark choice stays. Saving needs `settings:update`; with only
  `settings:read` everything shows but can't be changed.
- `ColourChoice.tsx` and `FontPairingChoice.tsx` are the colour and font pickers.
- `ViewPageLink.tsx` is **View page** in the editor's Status panel, shown once an entry is
  live. `pageAddress.ts` builds the address the way the site serves it: the page with the
  slug `home` is the root, and other languages are under their code (`/fr-FR/about`).
- Live preview needs nothing here: for collections with pages, the API's preview address
  is the real site with a preview token (see `src/preview`).

| File                 | What it does                               |
| -------------------- | ------------------------------------------ |
| `website.api.ts`     | Calls to `/website` and `/website/address` |
| `website.queries.ts` | TanStack Query hooks for them              |
| `pageAddress.ts`     | An entry's full address on the website     |
