# Content roots (site starts)

A **site start** is a page at the top of a page tree: an entry with no parent in a `tree`
collection that has a route pattern. It is a site's start, as a root node is in Umbraco:
its own address is "/" and its children are "/about", never "/home/about". The reasoning
is in `docs/decisions/0022-site-starts-and-hostnames.md`.

## Addresses

- One site start: it is "/".
- Several: the first in the tree's order (sections by name, then the order set by hand) is
  "/", and the others answer under their slug: "/shop", "/shop/boots".
- **Hostnames** (the "…" menu of a page at the top, like Umbraco's "Culture and hostnames")
  gives one a domain ("shop.example.com"), a path prefix ("/store"), or both. The first
  site start _without_ one is "/"; a site start may also claim "/" on purpose.
- Below a site start, addresses still come from route patterns ("/{slug}"), with the site
  start's prefix or domain in front. Posts, products and other non-tree entries are never
  under a site start and keep their pattern addresses.
- Drafts count: a site start's place doesn't change when it is published.

Every feature that shows an address builds it from the route pattern as before
(`buildEntryUrl` in `src/delivery`) and passes it through `placeEntryUrls`, which reads the
site starts in a few queries for any number of entries. That covers the delivery API,
GraphQL, links between entries, events (and so redirect suggestions), previews, the
sitemap, the Info tab and the built-in website.

## Endpoints

| Method and path                           | Permission        | Body                       | Success                                                             |
| ----------------------------------------- | ----------------- | -------------------------- | ------------------------------------------------------------------- |
| `GET /content-tree/entries/:id/hostnames` | `entries:read`    | none                       | 200 `{ entryId, hostname, pathPrefix, isAssigned, isDefault, url }` |
| `PUT /content-tree/entries/:id/hostnames` | `settings:update` | `{ hostname, pathPrefix }` | 200 the same; both empty takes it back to the default               |

400 `NOT_A_SITE_START` for a page that isn't at the top; 409 `ROOT_ADDRESS_TAKEN` when
another site start already answers on that domain and path. Domains and paths are tidied
("https://Shop.Example.com/" is "shop.example.com", "Store/" is "/store").

## Multisite

Multisite (on `release/1.0.0-rc`, `src/sites`) decides which **site** a request is for, from
its domain and path prefix (`request-site.ts`, `site-addresses.ts`). This folder decides which
**site start** within a site. When the two meet:

1. `root-addresses.ts` repeats `normalizeHostname`, `normalizePathPrefix`, `isUnderPrefix`
   and `removePathPrefix` from `sites/site-addresses.ts` with the same names and rules:
   import those instead and keep only the site start rules here.
2. Site starts are already read per site and language (`listSiteStarts(siteId, locale)`),
   so on the website: resolve the site with `resolveDeliverySite`, take the site's prefix
   off the path (`removePathPrefix(site.pathPrefix, path)`), then pick the site start with
   `matchRootForPath`, letting one with a hostname answer only when the request's host
   matches it (the rule of `hostnameMatches` in `site-addresses.ts`, exported for it). That is the one change to
   `respondUnderSiteStart` in `src/website/site-pages.service.ts`, which today compares
   paths only.
3. `placeEntryUrls` should then add the site's own prefix (`addPathPrefix`) in front of
   what it builds, and a full address with a domain only when the site start's domain
   isn't one of its site's `hostnames`.
4. Redirects are one list for the install; with several sites, "Add redirects" after a
   move should file them under the moved page's site.

## Files

| File                          | What it does                                                         |
| ----------------------------- | -------------------------------------------------------------------- |
| `root-addresses.ts`           | The address rules, as pure functions                                 |
| `content-roots.table.ts`      | `content_root_addresses`: a site start's domain and prefix           |
| `content-roots.repository.ts` | Database reads and writes                                            |
| `content-roots.service.ts`    | Site starts in order, `placeEntryUrls`, reading and saving Hostnames |
| `content-roots.schema.ts`     | The Hostnames request and response                                   |
| `content-roots.errors.ts`     | Named errors with the messages people see                            |
| `content-roots.routes.ts`     | The endpoints                                                        |
