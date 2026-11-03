# Visitors (analytics)

Counting the website's visitors without cookies or anything personal: the `analytics`
plugin. Why it works this way is in `docs/decisions/0042-built-in-visitor-counts.md`.

## How a visit is counted

1. The built-in website adds the beacon to public pages while the plugin is on
   (`page-tag.ts`, called from `website/site.routes.ts`).
2. The beacon (`analytics-script.ts`) posts events to `/_lintel/api/analytics/collect`,
   which the website passes to `/delivery/analytics/collect` with the visitor's address.
3. `collection.service.ts` drops Do Not Track, Global Privacy Control and robots, makes the
   day's visitor hash (`visitor-hash.ts`), applies the per-visitor limits
   (`visitor-limiter.ts`) and stores one row in `analytics_events`.
4. `rollups.service.ts` turns each day's events into `analytics_daily` rows
   (`daily-rollups.ts`), and deletes events past the retention.
5. `stats.service.ts` reads the daily rows for the admin.

Goals from forms and the shop are recorded by `goals.service.ts`, subscribed to the event bus
in `register-analytics.ts`, which also starts the timed jobs.

## Endpoints

| Method and path                         | Permission       | Success                                    |
| --------------------------------------- | ---------------- | ------------------------------------------ |
| `GET /delivery/analytics/script.js`     | public           | 200, the beacon                            |
| `POST /delivery/analytics/collect`      | public (limited) | 204                                        |
| `GET /analytics/stats?range=`           | `analytics:read` | 200 `VisitorStats`                         |
| `GET /analytics/pages?path=&range=`     | `analytics:read` | 200 `PageVisitorStats`                     |
| `GET /analytics/entries/:id?range=`     | `analytics:read` | 200 `PageVisitorStats`                     |
| `GET /analytics/export?range=`          | `analytics:read` | 200 `text/csv`                             |
| `GET`/`PUT /plugins/analytics/settings` | `settings:*`     | `{ retentionDays, countOnlyAfterConsent }` |

`range` is `today`, `7d`, `30d` or `custom` with `from` and `to` (366 days at most). Every
answer has the period before for comparison.

## For other features

`analytics-api.ts` is the only part other features should use: `identifyVisitor`,
`recordGoal` and `countPageVisitors`.

## Files

| File                           | What it does                                    |
| ------------------------------ | ----------------------------------------------- |
| `analytics.plugin.ts`          | The plugin: permission, settings, routes        |
| `analytics-events.ts`          | The event kinds and what the rollups count      |
| `analytics.table.ts`           | Events, daily figures and salts                 |
| `analytics.schema.ts`          | Requests and answers                            |
| `analytics-settings.schema.ts` | The plugin's settings                           |
| `analytics-script.ts`          | The beacon                                      |
| `page-tag.ts`                  | Adding the beacon to pages                      |
| `collect.routes.ts`            | The public endpoints                            |
| `analytics.routes.ts`          | The admin's endpoints                           |
| `collection.service.ts`        | Recording an event                              |
| `goals.service.ts`             | Goals from forms and orders                     |
| `rollups.service.ts`           | Daily figures and retention                     |
| `stats.service.ts`             | Reading figures, the CSV                        |
| `entry-pages.service.ts`       | Which page an entry is                          |
| `analytics-api.ts`             | What other features use                         |
| `analytics.repository.ts`      | Database reads and writes                       |
| `visitor-signals.ts`           | Reading a visit: robots, device, country, paths |
| `visitor-hash.ts`              | The daily visitor hash and salts                |
| `visitor-limiter.ts`           | Per-visitor limits in memory                    |
| `daily-rollups.ts`             | Counting a day's events (pure)                  |
| `register-analytics.ts`        | Event listeners and timed jobs                  |
