# 14. The built-in website is a core feature on its own port

Date: 2026-11-01

## Decision

Lintel serves the public website itself. The renderer is a feature folder in core
(`packages/core/src/website`) that starts a second, small Fastify server in the same
process as the API, on its own port (3000 by default, `SITE_PORT`). The components it draws
with are a separate package, `packages/site-components`: React components with plain props,
rendered to static HTML on the server. Rendered pages are kept in memory and emptied by
content events and by any successful write through the admin API.

## Why

Non-technical users must get a real website without installing or deploying anything
else. Serving it from the process they already run is the only way that is true in
development and in production alike.

**A core feature rather than a `packages/site` server.** A separate server would have to
read content through the public delivery API over HTTP, or open the database itself. The
first adds a network hop and a second cache to every page, and makes drafts, the main menu
and SEO need tokens; the second duplicates core's database choice (built-in database or
Postgres, switched during setup). Inside core, the website calls the same services the
delivery API uses, so it can never serve something the API wouldn't, and it follows the
setup screen switching databases for free. It reacts to `announceContentEvent` directly,
which is how scheduled publishing invalidates it too.

**Its own port rather than routes on the API.** The API's paths (`/media`, `/delivery`,
`/auth`...) would otherwise clash with page addresses an editor can choose, and the API's
CORS, cookies and rate limits would apply to visitors. A separate Fastify instance shares
the API's database, media lookup and cache, but none of its HTTP behaviour. Putting both
behind one domain is a reverse proxy's job (`/` to the site, `/api` to the API).

**Components in their own package.** The page builder will render the same components on
its canvas, so they can't depend on core, the database or fetching. Keeping them in a
package with plain props and plain CSS makes that boundary impossible to cross by
accident, and lets developers read and edit the HTML and CSS directly.

**Static HTML, no hydration.** The site ships no JavaScript: menus and FAQs are native
`<details>` disclosures. Pages are smaller, faster and work everywhere; anything
interactive later can be added per component.

## Consequences

- The site's address defaults to `http://localhost:<SITE_PORT>` (`SITE_PUBLIC_URL` in
  production) and is the `siteAddress` setting once someone types one in Settings → Your
  website, so there is one site address, used for canonical links, the sitemap and "View
  page". (Before 1.0 the SEO settings kept their own address; migration 0012 moves it into
  `siteAddress`.)
- Live preview for collections with pages uses the real site with a preview token, unless
  the collection has its own preview address (an external site).
- Headless sites are unaffected; `SITE_ENABLED=false` turns the built-in site off.
- The in-memory cache is per process. With several API processes, a change made through one
  shows on the others within ten minutes, when their pages expire. A shared cache is worth
  adding if Lintel is ever scaled out that way.
