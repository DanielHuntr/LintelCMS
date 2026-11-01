# Content model screens

Glue for the content that isn't a collection's entries.

- `contentModelRoutes.tsx` creates the routes for taxonomies, global settings and menus
  (beside the content tree, in the Content section) and languages (under Settings);
  router.tsx passes in both parents, so they live in one visible list without crowding
  router.tsx.
- They appear in the content tree's "Site-wide" section (`src/content-tree/SiteWideSection.tsx`),
  shown only to people who may see them.

The screens themselves are in `src/taxonomies`, `src/globals`, `src/menus` and
`src/locales`. Their words are in `src/i18n/contentModelStrings.ts`, used through `t()`.
