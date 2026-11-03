# Static site

The website as a folder of ordinary files, for hosting that can't run Lintel. Every page
is drawn by the live website's own code (`src/website`, `respondToSitePath`) with
`@lintel/site-components`, so a published page is the live page byte for byte, except that
pictures point at copies saved beside it.

`exportStaticSite({ api, folder })` writes:

| What                                        | Where                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Every published page and post               | `about/index.html`, `blog/hello/index.html`                           |
| Blog lists and archives, every page of them | `blog/index.html`, `blog/page/2/index.html`                           |
| The home page and the 404 page              | `index.html`, `404.html`                                              |
| `sitemap.xml`, `robots.txt`, RSS            | as on the live site; RSS at `blog/feed.xml`                           |
| Redirects from the SEO plugin               | a tiny page at the old address, and rules                             |
| Pictures, every size the pages ask for      | `media/<asset>/<version>-<w>x<h>-cover.webp`                          |
| The stylesheet and the forms script         | `_lintel/site-<fingerprint>.css`, `_lintel/forms.js`                  |
| Search                                      | `search/index.html`, `_lintel/search-index.json`, `_lintel/search.js` |
| Server settings                             | `.htaccess` (Apache), `web.config` (IIS)                              |

## Only what changed

`static-pages.service.ts` lists every address with what it is built from: `site` (the look,
header, footer, menus, redirects, forms), `entry:<id>` (one entry and the pictures and
entries it points at), `collection:<handle>:<locale>` (a list's entries) and `everything`
(the sitemap). `.lintel-manifest.json` in the folder keeps each page's fingerprint and
every file's SHA-256. A page is drawn again only when a fingerprint changed or its file was
changed or removed by hand; files no longer part of the site are deleted.

So publishing one post redraws that post, its blog's lists, archives and feed, the home
page and the sitemap; changing the menu redraws everything, since every page shows it.

## One site per export

Each export is one site (`site`, the default site when left out), and each publishing
destination names the site it publishes. Entries come from that site (and the shared
collections), page addresses from the content tree (`placeEntryUrls`), and files go under
the site's path prefix (`/ie/about/index.html`); the website's own files stay at `/_lintel`.
A page under a site start with a domain of its own is left out: that domain is a website of
its own.

## What a folder of files can and can't do

Pages are drawn as the live site draws them, with these differences:

| Feature                                     | On a file host                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| Navigation and footer sections, site styles | Drawn into every page; a change redraws every page (see `sharedLook`)             |
| Fonts (included, uploaded, Google)          | The files the stylesheet names are copied in; Adobe Fonts load from Adobe         |
| Animations, effects, sliders, menus         | The motion runtime, effect modules and elements script are copied in              |
| Cookie notice                               | Works: its script is copied and keeps the choice in the visitor's browser         |
| Forms (Form sections and forms in designs)  | Post to the PHP companion, or to Lintel's API on buckets; a fresh token each time |
| Shop pages (`/shop`, with the companion)    | Work: see `src/bridge`                                                            |
| Shop buttons and baskets in designs         | Need a running Lintel; the export warns which pages have them                     |
| Visitor counts (Visitors plugin)            | Left out: there is nothing to count visits                                        |
| A/B tests                                   | Left out: the original version is published                                       |
| Sorting and further pages of designed lists | First page only: `?sort=` and `?page=` need a server                              |
| Member logins and members-only pages        | Need a running Lintel                                                             |

`static-assets.ts` finds and copies the `/_lintel/...` files; `static-pages-on-files.ts`
points builder forms at the form endpoints and spots shop elements.

| File                        | What it does                                       |
| --------------------------- | -------------------------------------------------- |
| `static-export.service.ts`  | The export: draw, copy pictures, write, tidy up    |
| `static-pages.service.ts`   | Which addresses there are and what each depends on |
| `static-site.repository.ts` | The few reads the export needs of its own          |
| `static-files.ts`           | Addresses to files, the manifest                   |
| `static-media.ts`           | Finding and rewriting picture addresses            |
| `static-assets.ts`          | The website's own files the pages and styles name  |
| `static-pages-on-files.ts`  | Builder forms pointed elsewhere; shop elements     |
| `static-search.ts`          | The search index, page and script                  |
| `host-settings.ts`          | `.htaccess` and `web.config`                       |
| `redirect-page.ts`          | The page left at an old address                    |
