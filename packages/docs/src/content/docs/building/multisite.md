---
title: Multi-site for developers
description: How the delivery API, GraphQL, previews and sitemaps pick a site, with examples.
since: "0.1"
sidebar:
  label: Multi-site
---

One Lintel can serve several sites. Editors set them up in **Settings → Sites** (see
[running several sites](/using/sites/)); this page is about reading each site's content
from your website. With a single site you can ignore all of it: every request is for that
site, whatever domain it comes from.

## How a request picks its site

Every public endpoint (the [delivery API](/building/delivery-api/), `/graphql`,
`/sitemap.xml` and `/robots.txt`) answers for one site, chosen in this order:

1. `?site=<handle>` in the query string.
2. The `Lintel-Site: <handle>` header.
3. The domain the request came to: `X-Forwarded-Host` when a proxy sets it, else `Host`.
   This only applies once there are two or more sites.
4. The default (main) site.

An unknown handle is a 404 with the code `SITE_NOT_FOUND`, so a typo fails loudly instead
of quietly serving the main site. Responses send `Vary: Lintel-Site, X-Forwarded-Host`, so
caches keep each site's answers apart.

```bash
# The French site's blog, by handle
curl "http://localhost:4000/delivery/blog?site=france"

# The same, by header (handy when one client serves several sites)
curl -H "Lintel-Site: france" http://localhost:4000/delivery/blog

# By domain, when the API sits behind the same domain as the site
curl -H "Host: acme.fr" http://localhost:4000/delivery/blog
```

A website that serves several sites from one codebase usually sends the handle explicitly
rather than relying on the `Host` the API sees. The `Lintel-Site` header is allowed in
browser requests from other origins.

## Finding the site for an address

`GET /delivery/sites` lists every site: its `handle`, `name`, `isDefault`, `hostnames`,
`pathPrefix`, `siteUrl`, `defaultLocale`, `locales` and `branding`. Use it for language or
country switchers.

`GET /delivery/site` returns the one site the request is for, by the rules above.

`GET /delivery/sites/match?url=<full address>` works out the site for a page address and
the path within it, which is what a front end needs to route a request:

```bash
curl "http://localhost:4000/delivery/sites/match?url=https://acme.com/fr/about"
# { "site": { "handle": "france", "pathPrefix": "/fr", ... }, "path": "/about" }
```

When several sites share a domain, the longest path prefix that fits wins: `/fr/about`
goes to the site at `/fr`, `/about` to the one with no prefix. An address no site answers
on is a 404.

## What each site serves

- **Per-site collections** serve only that site's entries. A collection the site doesn't
  use is a 404 there.
- **Shared collections** serve the same entries on every site.
- Entry `url`s include the site's path prefix, so `/about` on the site at `/fr` is
  `/fr/about`.
- **Menus** (`/delivery/navigation/:handle`) and **globals** (`/delivery/globals/:handle`)
  are the site's own. `?locale=` picks one of that site's languages.
- **Taxonomies** include those every site shares and the site's own.
- **Media** URLs are the same on every site.

GraphQL takes the site the same way, from `/graphql?site=france` or the header. Queries
are otherwise unchanged.

## Sitemaps, robots.txt and previews

`/sitemap.xml` and `/robots.txt` are per site. They need the site's **Site address** (set
in Settings → Sites), since sitemaps hold full URLs; until it's set, the sitemap answers
with a message saying so.

Preview address patterns can use `{site}` (the site's handle) and `{siteUrl}` (its
address), so one pattern serves every site:

```text
{siteUrl}/api/preview?path={url}
```

## In the admin API

The admin sends `Lintel-Site: <handle>` with every request, and lists, editors and
creation all work on that site. Without it, requests are for the main site. A person whose
roles are kept to some sites gets a 403 for any other site, and for entries that belong to
one. `GET /sites` lists only the sites the signed-in person may work on.

| Method and path                  | Permission        | What it does                                |
| -------------------------------- | ----------------- | ------------------------------------------- |
| `GET /sites`                     | signed in         | The sites the person may work on            |
| `POST /sites`                    | `settings:update` | Adds a site                                 |
| `PATCH /sites/:handle`           | `settings:update` | Changes a site; the handle can't change     |
| `DELETE /sites/:handle`          | `settings:update` | Deletes a site with no entries              |
| `PUT /sites/access/:roleHandle`  | `settings:update` | `{ siteHandles: [...] }`, or `null` for all |
| `POST /entries/:id/copy-to-site` | `entries:create`  | `{ site }`: a new draft on that site        |

The code lives in `packages/core/src/sites`; `request-site.ts` is the one place a site is
chosen for a request. The reasoning is in `docs/decisions/0012-several-sites-in-one-install.md`.
