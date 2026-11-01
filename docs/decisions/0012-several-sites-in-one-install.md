# 12. Several sites in one install

Date: 2026-11-01

## Decision

One Lintel serves several websites. A **site** is a row in `sites` with a handle, a name,
the domains it answers on (`hostnames`), an optional path prefix (`/fr`), its public
address (`siteUrl`), its languages and a small `branding` object. The site made for every
install so far stays the default ("main") site.

What belongs to a site:

- **Entries** always have a `site_id`. A collection is either `per-site` (each site writes
  its own entries; `site_ids` can limit which sites have the collection at all) or
  `shared` (one set of entries, kept on the default site, shown on every site).
- **Menus and global values** belong to one site. Global sets (the fields) are shared, so
  every site fills in the same "Footer" in its own way.
- **Taxonomies** have a nullable `site_id`: null means every site shares it.
- **Media** is one library. An asset's nullable `site_id` only files it in that site's
  folder; any site can use any file.
- **Roles** have a nullable `site_ids`. Someone's sites are the union of their roles' lists,
  and one role with null (or no roles at all) means every site.

Which site a request is for is decided in one place, `packages/core/src/sites/request-site.ts`:

- Websites (delivery, GraphQL, sitemap, robots.txt): `?site=<handle>`, else the
  `Lintel-Site` header, else the domain the request came to (`X-Forwarded-Host`, else
  `Host`), else the default site. Responses send `Vary: Lintel-Site, X-Forwarded-Host`.
- The admin: `?site=` or the `Lintel-Site` header it sends with every request, else the
  default site, after checking the person may work on it.

Routes resolve the site and pass it to their service as an argument. Nothing is stored on
the request.

The migration (`0010_add_multisite`) gives existing menus and global values to the default
site, creating it if the install never needed one, and copies a real `domain` into
`hostnames`. Domain matching only starts once there is a second site, so an install with
one site answers exactly as before, whatever `Host` it is reached on.

## Why

Agencies run a brand in several countries, or several small brands, and want one admin,
one media library and one set of people. Umbraco and Statamic both model this as sites
inside one install, and editors understand "which site am I working on?" better than
switching between installs.

A site is the unit of language too ("Acme France in French"), which keeps translations
(decision 0007) inside one site. Copying an entry to another site makes an unlinked draft
rather than a translation, because each country's page usually diverges.

Passing the site explicitly, rather than hiding it in request state, makes every query
that should be scoped visibly take a site, and lets tests call services directly.

## Alternatives considered

- **One install per site**: no shared media, users or content types, and twice the
  upgrades. This is what people were already doing and wanted to stop.
- **A tenant per site**: `tenantId()` (decision 0003) is for fully separate customers on
  one database. Sites inside a tenant share people, media and content types, which a
  tenant boundary is designed to prevent.
- **A site column on collections only**: simpler, but forces a "UK pages" and "France
  pages" collection for every content type, and the delivery API URLs would differ per site.
