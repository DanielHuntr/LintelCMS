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

## Sites per site

There is one site per install on this branch (`sites` has a single row). The export reads
everything through the same services as the live site, which take the site from the
request, so when multisite arrives an export is per site: one folder and one destination
per site.

| File                        | What it does                                       |
| --------------------------- | -------------------------------------------------- |
| `static-export.service.ts`  | The export: draw, copy pictures, write, tidy up    |
| `static-pages.service.ts`   | Which addresses there are and what each depends on |
| `static-site.repository.ts` | The few reads the export needs of its own          |
| `static-files.ts`           | Addresses to files, the manifest                   |
| `static-media.ts`           | Finding and rewriting picture addresses            |
| `static-search.ts`          | The search index, page and script                  |
| `host-settings.ts`          | `.htaccess` and `web.config`                       |
| `redirect-page.ts`          | The page left at an old address                    |
