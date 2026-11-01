# 7. Translations are linked entries, and sites have locales

Date: 2026-11-01

## Decision

A site has one or more locales (languages), kept in `site_locales`. Its main language is
the site's existing `locale` column, which always has a row there too. A fresh install
has one locale; more are added in Settings, Languages.

Every entry has a `locale`. A translation is an ordinary entry in another locale whose
`originId` points at the entry it was translated from. Every translation points at the
same origin, never at another translation, so an entry and its translations form a small
family: the origin plus the entries with `originId` equal to its id.

- Each translation has its own values, slug, status, schedule and revision history, so
  the French page can be published a week after the English one.
- Slugs are unique per collection, site and locale, so a translation can keep its
  origin's slug (`/contact` in every language) or have its own (`/a-propos`).
- In a page tree, a translation's parent is in its own language. A new translation goes
  under the translation of its origin's parent when there is one.
- `POST /entries/:id/translations { locale }` starts a translation as a draft copy of the
  entry's values, ready to translate.
- Lists, slug lookups and the delivery API take `?locale=`, defaulting to the main
  language. A single delivered entry lists its published translations
  (`translations: [{ locale, slug, url }]`) for language switchers and `hreflang` links.
- Entries fields and menu items store the id they were given. When delivering in a
  locale, the linked entry's translation in that locale is used if one is published.
- Global sets keep one row of values per locale. A locale with nothing saved shows, and
  delivers, the main language's values; saving it for the first time starts from them.
- Deleting an origin leaves its translations as standalone entries.

Taxonomy terms and menu labels are not translated yet.

## Why

Most sites that need a second language need it for some content, written by people who
work through it page by page. Treating a translation as an entry means everything that
already works for entries (validation, slugs, publishing, scheduling, revisions, the
editor, the delivery API) works for translations with no special cases, and a missing
translation is simply a missing entry. One flat link to the origin keeps "which pages are
the same page" a single indexed lookup.

## Alternatives considered

- **Values per locale inside one entry** (`data: { en: {...}, fr: {...} }`): one row per
  page, but every field, validation message, revision and published copy becomes
  locale-shaped, and the languages can't be published separately.
- **A site per language** (the original `sites` model, where each site is one language):
  closer to how large multi-site installs work, and still possible later, but it makes
  adding a second language to a small site feel like setting up a second website.
- **Translations pointing at each other in a chain**: no need to know which entry is the
  origin, but finding all versions of a page would need a recursive query.
