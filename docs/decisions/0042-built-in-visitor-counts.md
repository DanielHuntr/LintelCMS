# 42. Built-in visitor counts, without cookies

Date: 2026-11-03

## Decision

Lintel counts its websites' visitors itself, as the **Visitors** plugin (`analytics`), with
no third party, no cookies and nothing that identifies a person.

- **Collection.** Published pages load a small beacon (`/_lintel/api/analytics/script.js`,
  added to `<head>` as the page is sent, only while the plugin is on). It sends a page view
  (path without query or anchor, referring domain or `utm_source`, `utm_campaign`, window
  width), one "leave" with the time the page was in view, links to other sites, and named
  events (`lintelAnalytics.track("signup")`). Nothing is kept in the browser.
- **Telling visitors apart.** `SHA-256(daily salt, site, address, browser)`, kept as a
  32-character hash. The salt is random, made each day and deleted when the day is over, so
  a hash can't be reversed and today's visitors can't be linked to yesterday's. The address
  and browser are never stored. A person visiting on two days counts twice in a week; that
  is the price of never following anyone.
- **Not counted:** Do Not Track or Global Privacy Control, robots (user agent, and
  `navigator.webdriver` in the beacon), the same page reloaded within ten seconds, more than
  300 events an hour from one visitor, and more than 120 requests a minute from one address.
- **Country** comes from the region in the browser's first language (`en-GB` is GB). No
  GeoIP database, no lookups. The screen says it is a good guess.
- **Goals** are recorded by the server from the event bus: `form.submitted` ("form:<handle>",
  on the page it was sent from) and `order.paid` ("order", with its value, on the main site).
  They carry no visitor. Conversion rate is goals per 100 visitors, capped at 100%.
- **Storage.** Single events go in `analytics_events` (every row has `tenant_id` and
  `site_id`) for `retentionDays` (30 by default, 7 to 365), deleted a whole day at a time.
  Daily figures per site, day, dimension (total, page, source, campaign, device, country,
  goal, outbound, event) and key go in `analytics_daily` and are kept. A job counts today and
  yesterday every five minutes (every kept day once at start) and applies the retention
  hourly, even while the plugin is off. Days are UTC days.
- **On by default for new sites** (`pluginsForEverySite`): it needs no consent, and a site
  owner expects to see whether anyone visits. Existing sites switch it on in Build → Features.
- **Consent.** Because counting is cookieless and anonymous it doesn't wait for consent.
  The setting **Count visitors only after they accept** adds `data-consent="required"`; the
  beacon then counts nobody until `window.lintelConsent.allows("plugin:analytics")` is true,
  the `lintel:consent` event lists `plugin:analytics`, or the site calls
  `lintelAnalytics.consent()`. The cookie notice lists "plugin:analytics" as a service
  when the setting is on.
- **Permission** `analytics:read` (see visitors, export). Owners have it (`*`), Admins get
  `analytics:*`, Editors get `analytics:read`; Authors and Viewers don't. Settings use the
  plugin settings endpoints (`settings:read` / `settings:update`).

## For experiments

The event model is `view`, `leave`, `outbound`, `goal`, `custom`, with a `properties` column
for things like `{ experiment, variant }`. `src/analytics/analytics-api.ts` is the seam other
features use: `identifyVisitor` (today's hash for a request), `recordGoal` and
`countPageVisitors`. Matching an exposure to a goal works within one day only, by design.

## Why not

- **A third-party service** sends visitors' data elsewhere and needs a consent banner.
- **Cookies or local storage identifiers** need consent in most of Europe.
- **GeoIP** needs a database we would ship and update, or a lookup elsewhere.
