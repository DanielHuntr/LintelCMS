# Sites

A site is one website served by this install, in one language: "Acme UK in English" and
"Acme France in French" are two sites. Entries belong to a site, so the same collection
can hold each site's own pages.

For now every install has exactly one site, created the first time anything needs it
(`findOrCreateDefaultSite`). Managing several sites and domains comes later.

## Languages (locales)

A site has one or more locales in `site_locales`. Its main language is the site's `locale`
column, which always has a row there too (made the first time it's needed). Entries and
global values are kept per locale; a translation is an entry linked to its origin. See
`docs/decisions/0007-translations-as-linked-entries.md`.

Codes are BCP 47 language tags, tidied with `Intl` ("FR-fr" becomes "fr-FR"), and named
in English by default ("French (France)"). `resolveLocale(database, requested)` is what
other features call for a `?locale=`: the site's main language when none is given, or a
404 for one the site doesn't have.

| Method and path         | Permission        | Success                                            |
| ----------------------- | ----------------- | -------------------------------------------------- |
| `GET /locales`          | signed in         | 200 `{ defaultLocale, locales: [Locale] }`         |
| `POST /locales`         | `settings:update` | 201 `Locale`, from `{ code, name? }`               |
| `PATCH /locales/:code`  | `settings:update` | 200 `Locale`, from `{ name }`                      |
| `DELETE /locales/:code` | `settings:update` | 204, or 409 `DEFAULT_LOCALE` / `LOCALE_IN_USE`     |
| `GET /delivery/locales` | public            | 200 `{ defaultLocale, locales: [{ code, name }] }` |

`Locale = { code, name, isDefault, entryCount }`. A locale can only be removed when no
entries are written in it; global values saved in it are kept and come back if it is
added again.

## The website's address

Settings → Site keeps one address, such as `https://www.example.com` (only its origin is
kept), in the `siteAddress` setting. It is in every session (`siteAddress` on `/auth/me`) so
the admin can link "View page" to the live page, and the sitemap and canonical addresses
fall back to it when the SEO settings have no address of their own. Empty means no website
is connected yet.

| Method and path     | Permission        | Success                              |
| ------------------- | ----------------- | ------------------------------------ |
| `GET /site-address` | `settings:read`   | 200 `{ siteAddress }`                |
| `PUT /site-address` | `settings:update` | 200 `{ siteAddress }`, from the same |

| File                      | What it does                                         |
| ------------------------- | ---------------------------------------------------- |
| `sites.table.ts`          | The `sites` table                                    |
| `sites.service.ts`        | `findOrCreateDefaultSite` and the default's values   |
| `sites.repository.ts`     | Database reads and writes                            |
| `locales.table.ts`        | The `site_locales` table                             |
| `locales.schema.ts`       | Language codes, requests and responses               |
| `locales.service.ts`      | Listing, adding, renaming, removing; `resolveLocale` |
| `locales.repository.ts`   | Database reads and writes for locales                |
| `locales.errors.ts`       | Named errors with the messages people see            |
| `locales.routes.ts`       | The endpoints                                        |
| `site-address.schema.ts`  | The address request (an origin, or empty)            |
| `site-address.service.ts` | `readSiteAddress` and `saveSiteAddress`              |
| `site-address.routes.ts`  | The endpoints                                        |
