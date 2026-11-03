# 60. First-party add-ons

Date: 2026-11-03

## Context

Decision 0052 made the add-on kit: plugins as npm packages, installed into a site's Lintel
folder with `lintel addons add`. Its only add-on was the example. To prove the kit on real
work, and to give sites the add-ons people ask for most, Lintel now ships a few of its own.

Five were asked for: newsletter sign-up (Mailchimp and Brevo), site search, redirects, an
Instagram feed and extra field types (icon, colour palette, map location, table). Before
building, each was checked against what Lintel already does:

| Asked for          | Already in Lintel                                                                                                                                                          | Done here                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Newsletter sign-up | The Newsletter element, which keeps sign-ups as form answers                                                                                                               | `@lintel/addon-newsletter`                                                           |
| Site search        | The Search box element and the `/search` results page, searching titles and summaries                                                                                      | Core: search reads every word of a page; `{% search_box %}` for Liquid templates     |
| Redirects          | The SEO tools plugin: a redirects screen, 301 and 302, CSV import, applied by the website, and a suggested redirect whenever a live page's address changes (`entry.moved`) | Nothing: an add-on would be a second, competing list                                 |
| Instagram feed     | Nothing                                                                                                                                                                    | `@lintel/addon-instagram`                                                            |
| Extra field types  | Icon (lucide names), Table, and Colour with suggested swatches                                                                                                             | `@lintel/addon-extra-fields`: Map location and Colour palette, the two that were new |

## Decision

### Three add-on packages, built with the kit as any developer would

Each is `packages/addon-<name>`: a `lintel-addon` section in package.json, `src/server` and
`src/admin` bundled by `lintel addons build`, tests on a real Lintel
(`@lintel/core/plugin-testing`), and a README. They import only `@lintel/core/plugin` and
`@lintel/admin/plugin`, so they prove the public surface is enough. Their `files` list ships
`dist`, the README and their migrations, so `pnpm pack` makes a package that
`lintel addons add <file>.tgz` installs into any site.

- **Newsletter sign-up** (`newsletter`): a connection to Mailchimp or Brevo, an element and
  a `{% newsletter_signup %}` tag with a consent tick box, and sign-ups from the site's own
  Newsletter element's form (handle `newsletter`) or any form with a ticked `newsletter` box.
  Double opt-in is on by default.
- **Instagram feed** (`instagram`): the official Instagram API with a token the owner
  pastes; posts and their pictures are copied to the site's database every hour and the
  token is renewed daily. An element and a `{% instagram_feed %}` tag show the grid.
- **Extra fields** (`extra-fields`): Map location (coordinates, name and address, filled in
  by pasting a map link) and Colour palette (named colours, delivered with a readable text
  colour), with Liquid filters and a Map element.

### Privacy: visitors' browsers never talk to these companies unasked

- Mailchimp, Brevo and Instagram are only ever called by the server. The Instagram grid's
  pictures are served from the site's own address. Neither add-on needs the cookie notice.
- The map is the one thing that loads from another company. Extra fields declares
  OpenStreetMap as a consent service; the map stays a button until the visitor allows it.
  In the admin, the editor's own "Show map preview" loads it.

### Secrets live in the add-on's own tables, not its settings

Plugin settings are readable by anyone with `settings:read` and travel to the admin as they
are. API keys and tokens are kept in each add-on's own table (`newsletter_connection`,
`instagram_account`, each with `tenantId()`), and the admin only ever sees a hint. Each
add-on's migrations are in its own `migrations` folder, applied and recorded apart from
Lintel's (decision 0012), so core's migration numbers are untouched.

### Add-ons' routes for visitors are answered at the website's address

Block templates and Liquid tags are drawn into cached pages, so a sign-up form or a feed
has to talk to the add-on after the page loads. The website now passes
`/_lintel/api/addons/*` to `/delivery/add-ons/*` on the API, as it already did for forms and
the shop; `ADDON_PUBLIC_PREFIX` in `@lintel/core/plugin` names it. The dash keeps it apart
from collections, whose handles can't have one. Answers stay uncached unless the add-on
says how long to keep them (the feed's pictures, for a year).

## Consequences

- Sites built with static publishing have no API beside them, so the sign-up form, the feed and its
  pictures can't reach the add-ons there.
- Redirects and search stay in core, one of each. A developer wanting something different
  can still build an add-on, using the same kit.
- Add-on field types have no options panel in the admin's content type editor yet, so
  their options (a palette's fixed colours, a map's zoom) are set in content model files or
  through the API.
