# Content roots (site starts)

A **site start** is a page at the top of a page tree: an entry with no parent in a `tree`
collection that has a route pattern. It is a site's start, as a root node is in Umbraco:
its own address is "/" and its children are "/about", never "/home/about". The reasoning
is in `docs/decisions/0024-site-starts-and-hostnames.md`.

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

Hostnames and multisite are one idea at two sizes: a **site** answers on its domains under
its path prefix (`src/sites`), and within it a **site start** can answer on a domain or path
of its own. The rules (tidying, matching a domain, the longest prefix winning) are the
site's, from `sites/site-addresses.ts`; this folder only adds the site start rules.

On the built-in website a visit is placed in this order:

1. The site, from the domain and path (`website/site-for-address.ts`). A domain no site
   lists but a site start does picks that site start's site.
2. The site's prefix comes off the path (`/fr/about` on a site served under /fr is `/about`).
3. The site start, with `matchRootForPath(starts, path, host)`: one with a domain of its own
   answers only on that domain (and comes first there); the others by the longest prefix.

`placeEntryUrls` does the same the other way round: the page's path under its site start,
then the site's prefix in front (`/fr/shop/about`), or a full address on the site start's
own domain (`https://shop.example.com/about`, which has no site prefix). Pass the site the
addresses are shown on as `{ site }`, or `site` on each address.

Redirects are still one list for the whole install, compared with the path inside the site.

## Addresses that follow the tree

`{path}` in a route pattern is the page's place in its tree: the slugs below its site start,
down to its own ("about/team"). Pages use `/{path}`, so Team under About is `/about/team`,
as in Umbraco; a pattern with `{slug}` (`/{slug}`, `/docs/{slug}`) is the override for flat
addresses. `placeEntryUrls` fills `{path}` in, since it already reads each entry's parents.
On the website the last part is the slug; an address with parents that aren't the page's
gets "not found", and the old flat address (`/team`) is sent on to the new one.

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
