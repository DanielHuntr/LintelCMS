# Website

The website Lintel serves itself, so a site works without installing anything else. It
runs as a second small server in the same process as the API (port 3000, or `SITE_PORT`),
started by `main.ts` in development and production alike. See
`docs/decisions/0011-built-in-website.md` for why it lives here.

It is a reader of the same published content the delivery API serves: every page is built
with the delivery services (`src/delivery`, `src/globals`, `src/navigation`,
`src/taxonomies`, `src/seo`), then drawn by `@lintel/site-components`. Headless use is
untouched; set `SITE_ENABLED=false` when the site is built separately.

## What an address shows

| Address                       | Shows                                                   |
| ----------------------------- | ------------------------------------------------------- |
| `/`                           | The page with the slug `home`, else the newest posts    |
| `/<slug>`, `/blog/<slug>`     | An entry, through its collection's route pattern        |
| `/blog`, `/blog/page/2`       | A dated collection's posts, ten a page, newest first    |
| `/blog/<taxonomy>/<term>`     | The posts filed under a term (`/blog/categories/bread`) |
| `/fr-FR/...`                  | The same in another of the site's languages             |
| `/sitemap.xml`, `/robots.txt` | From the SEO plugin, with the site's own addresses      |
| anything else                 | A friendly 404                                          |

`/home` and addresses with a trailing slash redirect (301) to their one true address, as
does a post's address with an old date in it. With the SEO plugin on, its active redirects
are answered first. Pages get the `<head>` the SEO plugin would give (title template,
description, social image, `noindex`), a canonical address and `hreflang` links between
translations. Without the plugin, titles are "Page | Site name".

The site's address is the SEO defaults' `siteUrl`, typed in Settings → Your website (or
Search engines). Left empty, it is the built-in site's own (`SITE_PUBLIC_URL`, or
`http://localhost:<SITE_PORT>`).

## Caching

Finished responses are kept in memory (`rendered-pages-cache.ts`) with an `ETag`, so most
visits cost no query and no rendering, and a browser checking again gets a `304`. The cache
empties when anything could have changed a page: every content event (publishing,
unpublishing, deleting, scheduled publishing; see `src/content-events`) and every
successful write through the admin API (a menu, a global, a setting). Pages also expire
after ten minutes. The stylesheet's address holds a fingerprint of its contents, so it is
cached by browsers for a year.

## Live preview

`?preview=<token>` on any page shows that entry's working copy with the real template,
`Cache-Control: private, no-store` and `noindex`, never cached. A collection without a
preview address of its own, whose entries have pages, is previewed here (see
`src/preview`), so the editor's preview is the real site. A bad or expired token gets a page
asking the editor to open the preview again.

## Look: templates and themes

The `website` setting holds the template (`clean` or `journal`), the theme choices (brand
and accent colour, font pairing, corners, spacing, light/dark/automatic) and the logo.
Anything not chosen follows the template's own theme; no template chosen follows the site
type from setup (a blog gets Journal, everything else Clean). An install can add templates
of its own with `buildServer({ website: { templates } })`.

| Method and path        | Permission        | Success                                         |
| ---------------------- | ----------------- | ----------------------------------------------- |
| `GET /website`         | `settings:read`   | 200 `Website`                                   |
| `PUT /website`         | `settings:update` | 200 `Website`, from any of its settings         |
| `GET /website/address` | signed in         | 200 `{ siteAddress, defaultLocale }`, View page |

There is no repository: everything is kept in settings and read through other features.

## Files

| File                      | What it does                                              |
| ------------------------- | --------------------------------------------------------- |
| `site-server.ts`          | The website's own Fastify server, reading through the API |
| `site.routes.ts`          | Its routes: the stylesheet, and every page                |
| `site-pages.service.ts`   | What to answer for an address; the cache in front of it   |
| `site-routing.ts`         | Which content an address could mean (pure)                |
| `site-lists.service.ts`   | Blog indexes and archives, with pagination                |
| `site-preview.service.ts` | Drafts with a preview token                               |
| `site-context.service.ts` | What every page shares: languages, collections, theme     |
| `site-chrome.service.ts`  | The header and footer: site settings and the main menu    |
| `site-head.service.ts`    | Title, description, canonical and Open Graph              |
| `site-views.ts`           | Which layout an entry gets                                |
| `site-documents.ts`       | Views to HTML responses, with headers                     |
| `delivered-to-site.ts`    | Delivered values to component props, read carefully       |
| `rendered-pages-cache.ts` | The in-memory cache                                       |
| `website-runtime.ts`      | `server.website`, and emptying the cache after writes     |
| `website.routes.ts`       | Settings, Your website's endpoints                        |
| `website.service.ts`      | Reading and changing the settings; the resolved look      |
| `website.schema.ts`       | The `website` setting and the request                     |
| `site-templates.ts`       | The templates on offer                                    |
| `website.errors.ts`       | Named errors with the messages people see                 |
