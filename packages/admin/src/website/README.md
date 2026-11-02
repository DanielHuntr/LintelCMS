# Website

Settings → Your website: the website Lintel serves itself and the site's one address. The
API side is in core's `src/website`.

- `SiteSettingsPage.tsx` is **Settings → Your website** (`/settings/site`): where the site
  is live (with **Open website**), the template, colours, fonts, light or dark, corners,
  spacing, the logo and the site's address. Picking a template brings that template's own
  look; the light or dark choice stays. Saving needs `settings:update`; with only
  `settings:read` everything shows but can't be changed.
- `ColourChoice.tsx` and `FontPairingChoice.tsx` are the colour and font pickers.
- The site's address is the one `siteAddress` setting. Left empty, the built-in website's
  own address is used; `GET /website/address` answers with whichever applies, and every
  **View page** (the editor's toolbar and the entry lists, see `src/content/viewPage.ts`) uses
  it. `pageAddress.ts` builds a page's address the way the site serves it: the page with the
  slug `home` is the root, and other languages are under their code (`/fr-FR/about`). With
  no address at all, View page opens Lintel's simple preview of the published version.
- Live preview needs nothing here: for collections with pages, the API's preview address
  is the real site with a preview token (see `src/preview`).

| File                  | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `website.api.ts`      | Calls to `/website` and `/website/address`          |
| `website.queries.ts`  | TanStack Query hooks for them                       |
| `pageAddress.ts`      | An entry's full address on the website              |
| `ViewWebsiteLink.tsx` | "View website" under the site's name in the sidebar |
