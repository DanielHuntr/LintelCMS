# Sites

A site is one website served by this install: "Acme UK" and "Acme France" are two sites.
Each has its own domains (`hostnames`), an optional path prefix for sites sharing a domain
(`/fr`), its public address (`siteUrl`), its languages and `branding`. The first site,
created the first time anything needs it (`findOrCreateDefaultSite`), is the default
("main") site and can't be deleted. The design is in
`docs/decisions/0019-several-sites-in-one-install.md`.

## What belongs to a site

- Entries always have a site. A collection is `per-site` (each site its own entries;
  `site_ids` can keep it to some sites) or `shared` (one set, kept on the default site,
  shown on every site). See `isCollectionOnSite` in `src/collections`.
- Menus and global values belong to one site; global sets (the fields) are shared.
- Taxonomies belong to one site, or to every site when `site_id` is null.
- Media is shared; an asset's `site_id` only files it in that site's folder.
- Roles can be kept to some sites (`roles.site_ids`); a person's sites are the union of
  their roles', and any role without a list opens every site (`SignedIn.siteIds` is null).

## Which site a request is for

`request-site.ts` is the only place this is decided. Routes call it and pass the `Site` to
their service; nothing is stored on the request.

- `resolveDeliverySite` (websites, GraphQL, sitemap, robots.txt): `?site=`, else the
  `Lintel-Site` header, else the domain (`X-Forwarded-Host`, else `Host`) once there are two
  or more sites, else the default site. It sets `Vary` so caches keep sites apart.
- `resolveEditingSite` (the admin): `?site=` or `Lintel-Site`, else the default site, and
  a 403 if the signed-in person's roles don't include it.
- `requireEntrySiteAccess`, a preHandler for `/entries/:id...`, refuses another site's
  entries to someone kept to some sites.

Address rules (tidying domains and prefixes, the longest matching prefix, clashes) are pure
functions in `site-addresses.ts`. A site with a path prefix and no domains of its own ("/ie")
answers on the default site's domain: the default site's domains, or any domain no site
lists when the default site has none.

## Sites

| Method and path                  | Permission        | Success                                          |
| -------------------------------- | ----------------- | ------------------------------------------------ |
| `GET /sites`                     | signed in         | 200 `{ sites: [Site] }` the person may work on   |
| `POST /sites`                    | `settings:update` | 201 `Site`                                       |
| `GET /sites/:handle`             | `settings:read`   | 200 `Site`                                       |
| `PATCH /sites/:handle`           | `settings:update` | 200 `Site`                                       |
| `DELETE /sites/:handle`          | `settings:update` | 204, or 409 for the default site or one in use   |
| `GET /sites/access`              | `settings:read`   | 200 `{ roles: [{ handle, name, siteHandles }] }` |
| `PUT /sites/access/:roleHandle`  | `settings:update` | 200, from `{ siteHandles: [..] \| null }`        |
| `GET /delivery/sites`            | public            | 200 `{ sites: [DeliveredSite] }`                 |
| `GET /delivery/site`             | public            | 200 `DeliveredSite` for this request             |
| `GET /delivery/sites/match?url=` | public            | 200 `{ site, path }`, or 404                     |

A new site gets empty copies of the default site's menus. Deleting one deletes its menus,
global values and languages, and moves its media folder back to the shared library.

## Languages (locales)

Each site has one or more locales in `site_locales`. Its main language is the site's `locale`
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
kept), in the `siteAddress` setting. It is the default site's address: it is in every
session (`siteAddress` on `/auth/me`) so the admin can link "View page" to the live page,
and the sitemap and canonical addresses use it. Other sites have their own address
(`siteUrl`, Settings → Sites); `readAddressForSite` gives the right one. Empty means no
website is connected yet.

| Method and path     | Permission        | Success                              |
| ------------------- | ----------------- | ------------------------------------ |
| `GET /site-address` | `settings:read`   | 200 `{ siteAddress }`                |
| `PUT /site-address` | `settings:update` | 200 `{ siteAddress }`, from the same |

| File                         | What it does                                               |
| ---------------------------- | ---------------------------------------------------------- |
| `sites.table.ts`             | The `sites` table                                          |
| `sites.service.ts`           | `findOrCreateDefaultSite`, finding sites by handle         |
| `sites.repository.ts`        | Database reads and writes                                  |
| `locales.table.ts`           | The `site_locales` table                                   |
| `locales.schema.ts`          | Language codes, requests and responses                     |
| `locales.service.ts`         | Listing, adding, renaming, removing; `resolveLocale`       |
| `locales.repository.ts`      | Database reads and writes for locales                      |
| `locales.errors.ts`          | Named errors with the messages people see                  |
| `locales.routes.ts`          | The endpoints                                              |
| `sites.schema.ts`            | Site requests and responses                                |
| `sites.routes.ts`            | The site endpoints                                         |
| `sites.errors.ts`            | Named errors for sites                                     |
| `site-management.service.ts` | Listing, adding, changing and deleting sites               |
| `site-access.service.ts`     | Which roles may work on which sites                        |
| `site-addresses.ts`          | Matching domains and path prefixes to sites                |
| `request-site.ts`            | Which site a request is for, and access checks             |
| `site-address.schema.ts`     | The address request (an origin, or empty)                  |
| `site-address.service.ts`    | `readSiteAddress`, `readAddressForSite`, `saveSiteAddress` |
| `site-address.routes.ts`     | The endpoints                                              |
