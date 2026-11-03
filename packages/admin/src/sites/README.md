# Sites

Running several websites from one Lintel: Build → Websites and domains at `/build/sites`
(`SitesPage.tsx`), the site switcher at the top of the sidebar, and the site choices other
screens show. The API side is in `packages/core/src/sites`; the design is in
`docs/decisions/0019-several-sites-in-one-install.md`.

## The current site

- `currentSite.ts` keeps the handle of the site being worked on (remembered in
  `localStorage`), and `siteHeaders()` turns it into the `Lintel-Site` header. The API
  client (`src/api/client.ts`) sends it with every request, so screens never pass a site
  along themselves.
- `loadSitesForAdmin.ts` loads the sites in the admin route's `beforeLoad`, so the site is
  settled before any screen asks for content.
- `SiteContext.tsx` provides `useCurrentSite()`: the site, every site the person may work
  on, `hasSeveralSites`, and `switchSite`, which resets the query cache so every list
  reloads for the new site. It returns null outside the signed-in admin.
- `SiteSwitcher.tsx` is a native select, hidden while there is only one site. Switching
  while an entry is open goes back to its collection on the new site.

## Build → Websites and domains

- `SitesPage.tsx` lists the sites, with an empty state for a single site.
  `SiteSheet.tsx` adds or edits one; `siteForm.ts` turns the form into the API's request.
- `CollectionSitesSection.tsx`: per collection, "Each site its own" (and which sites) or
  "Shared". Saved as soon as it changes.
- `RoleSitesSection.tsx`: which sites each role may work on, through `SiteChecklist.tsx`
  ("Every site", or some).

## Used by other screens

- `CopyToSiteDialog.tsx`, from the entry editor's menu, for per-site collections when
  there is more than one site.
- `SiteOwnershipChoice.tsx`, "Used on" when adding a taxonomy: every site or this one.
- `MediaFolderChoice.tsx`, the media library's Folder menu: all files, shared, or a site's.

Each of these hides itself with one site. Words are in `src/i18n/siteStrings.ts`, used
through `t()`.
