# SEO

The "SEO tools" plugin (`seo`, see `src/plugins`). While it is off, every endpoint here
answers 404 `PLUGIN_NOT_ENABLED` and no redirects are suggested.

## Page SEO

Each entry can have its own title, description, social image and "hide from search
engines" (`noindex`), set in the editor's Search engines panel and kept in `entry_seo`.
They take effect when saved, like a slug, rather than at the next publish. Anything left
empty falls back to the site defaults (the `seoDefaults` setting):

| Default                   | Used for                                                     |
| ------------------------- | ------------------------------------------------------------ |
| `siteName`                | `{siteName}` in the title template                           |
| `siteUrl`                 | Full addresses in the sitemap, robots.txt and `canonicalUrl` |
| `titleTemplate`           | `"{title}                                                    | {siteName}"`; must contain `{title}` |
| `defaultDescription`      | Pages without their own description                          |
| `defaultSocialImageId`    | Pages without their own social image                         |
| `discourageSearchEngines` | `Disallow: /` in robots.txt, and `noindex` on every page     |

`seo-titles.ts` builds titles and gives length advice (about 60 characters for a title,
160 for a description). The admin's search preview uses the same file, exported as
`@lintel/core/seo-titles`, so both always agree.

## Sitemap and robots.txt

`GET /sitemap.xml` lists every published entry in a collection with a route pattern,
except those marked `noindex`, with the publish date as `lastmod`. It needs `siteUrl`
(404 `SITE_ADDRESS_MISSING` until then). `GET /robots.txt` allows everything and points at
the sitemap, or disallows everything while search engines are discouraged. Both are public
and may be cached for an hour; a website serves them from its own address by passing those
two paths to the API.

## Redirects

One rule per old address (`fromPath`, tidied: no domain, query or trailing slash), to a
path or a full address, as 301 (moved for good) or 302 (moved for now). Websites read the
active ones from `GET /delivery/seo-redirects` (or GraphQL `redirects`) and answer with
them. A CSV import adds new rules and replaces existing ones for the same address, and
reports lines it couldn't use.

**Suggestions.** When a live entry's address changes (its slug or parent), the entries
route announces `entry.moved` (see `src/content-events`) and `suggestRedirectForMovedEntry`
adds a `suggested` 301 from the old address to the new. Suggestions do nothing until
accepted. At the same moment, existing redirects to the old address are pointed at the new
one, and any redirect away from the new address is removed, so there are no chains or
loops. Accepting a suggestion shortens chains to it in the same way.

## Endpoints

| Method and path                       | Permission        | Body                                                           |
| ------------------------------------- | ----------------- | -------------------------------------------------------------- |
| `GET /seo/defaults`                   | signed in         | none                                                           |
| `PUT /seo/defaults`                   | `settings:update` | any of the defaults                                            |
| `GET /seo/entries/:id`                | `entries:read`    | none                                                           |
| `PUT /seo/entries/:id`                | `entries:update`  | `{ title, description, socialImageId, noindex }`               |
| `GET /seo/redirects`                  | `settings:read`   | `?status=active\|suggested`                                    |
| `POST /seo/redirects`                 | `settings:update` | `{ fromPath, toPath, statusCode? }` -> 201                     |
| `PATCH /seo/redirects/:id`            | `settings:update` | `{ fromPath?, toPath?, statusCode?, status? }`                 |
| `DELETE /seo/redirects/:id`           | `settings:update` | none -> 204                                                    |
| `POST /seo/redirects/import`          | `settings:update` | `{ csv }` -> `{ added, updated, problems }`                    |
| `GET /delivery/seo-redirects`         | delivery access   | none -> `{ redirects: [{ from, to, statusCode }] }`            |
| `GET /delivery/:collection/:slug/seo` | delivery access   | none -> `{ title, description, canonicalUrl, image, noindex }` |
| `GET /sitemap.xml`, `GET /robots.txt` | public            | none                                                           |

"Delivery access" is the delivery API's rule: open, or a token when the site needs one.
`seo-redirects` can't clash with a collection, because handles can't contain a hyphen.

## Files

| File                                                             | What it does                              |
| ---------------------------------------------------------------- | ----------------------------------------- |
| `seo.table.ts`                                                   | The `entry_seo` and `redirects` tables    |
| `seo.schema.ts`, `redirects.schema.ts`, `seo-defaults.schema.ts` | Zod schemas                               |
| `seo.routes.ts`                                                  | The endpoints                             |
| `entry-seo.service.ts`                                           | An entry's SEO, and the finished version  |
| `seo-defaults.service.ts`                                        | Reading and changing the defaults         |
| `redirects.service.ts`                                           | The redirects manager and the CSV import  |
| `redirect-suggestions.service.ts`                                | Suggesting redirects when live pages move |
| `sitemap.service.ts`, `sitemap.ts`                               | sitemap.xml and robots.txt                |
| `seo-titles.ts`                                                  | Title templates and length advice         |
| `redirect-csv.ts`                                                | Reading CSV                               |
| `seo-plugin.ts`                                                  | Whether the plugin is on, and the guard   |
| `seo.repository.ts`, `redirects.repository.ts`                   | Database reads and writes                 |
| `seo.errors.ts`                                                  | Named errors with the messages people see |
