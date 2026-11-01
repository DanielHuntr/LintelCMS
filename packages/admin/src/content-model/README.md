# Content model screens

Glue for the content that isn't a collection's entries.

- `contentModelRoutes.tsx` creates the routes for taxonomies, global settings, menus and
  languages under the signed-in admin route (router.tsx passes it in), so they live in one
  visible list without crowding router.tsx.
- `SiteWideContent.tsx` is the "Across the whole site" group under the collections on
  `/content`, linking to each, shown only to people who may see them.

The screens themselves are in `src/taxonomies`, `src/globals`, `src/menus` and
`src/locales`. Their words are in `src/i18n/contentModelStrings.ts`, used through `t()`.
