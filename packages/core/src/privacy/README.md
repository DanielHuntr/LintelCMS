# Privacy

Settings → Privacy: the tools a site owner needs to look after the personal data their site
keeps, and to answer people who ask about theirs (data protection law such as GDPR and UK
GDPR). Lintel gives the tools and sensible defaults; whether a site meets the law also
depends on how it is run, and the admin says so. The reasoning is in
`docs/decisions/0065-privacy-tools.md`.

## What it does

- **Where personal data is kept** (`personal-data-map.service.ts`): every kind of personal
  data the site can hold, worked out from what it has. Lintel's own kinds are in
  `core-sources.ts`; plugins and add-ons add theirs by declaring it (below).
- **Find a person** (`person-requests.service.ts`): search by email (exact, any case) or a
  whole name; export everything as one .zip (`personal-data.json` and a CSV per kind,
  `personal-data-archive.ts`); erase it by each kind's rule. Every export and erasure is
  recorded in `privacy_requests`: who on the team did it and when, never who it was for.
- **Retention rules** (`retention.service.ts`): how long each kind is kept. They run every
  hour with the server's other jobs (src/scheduler), and the screen shows what the next run
  will remove.
- **Privacy policy helper** (`policy-helper.service.ts`): a draft "What this site collects",
  written from what the site uses (`site-services.service.ts`), and a word check of the
  privacy page.
- **Companies you share data with** (`processors.service.ts`): those Lintel finds, and those
  the owner adds.

Consent records live with form entries (src/forms, `consent-records.ts`): each ticked consent
box is saved with the exact words shown, the time and the page.

## Erasure rules

| Kind                           | What erasing does                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Form entries                   | Deleted, with their files and notes                                                    |
| Shop customers                 | Deleted                                                                                |
| Orders                         | Kept for tax records; email, name, address and phone removed (country and region stay) |
| Baskets                        | Deleted; unpaid checkouts have the person removed                                      |
| Security log                   | Kept as a record; email, name, IP address, browser and details removed                 |
| Webhook and automation history | Deleted, except automation runs still going                                            |
| Admin accounts                 | Kept: people who use the admin are removed in Users. Invitations are deleted           |
| Plugins/add-ons                | Whatever the plugin's `erase` hook does                                                |
| Backups                        | Can't be changed; erased data leaves them as older backups are replaced                |

Orders also lose the email from their history (`shop_order_events`), and checkouts and discount
redemptions are cleared with them. Outside companies keep their own records, and messages an
automation wrote into a notification aren't searched; the admin and docs say so.

## Retention defaults

| Rule              | Default        | Why                                                   |
| ----------------- | -------------- | ----------------------------------------------------- |
| Form entries      | Off, 12 months | Deleting messages unasked could surprise the owner    |
| Abandoned baskets | On, 30 days    | Nobody expects to keep them                           |
| Activity logs     | On, 90 days    | Long enough to look into a problem                    |
| Orders            | Off, 7 years   | Tax rules differ; the owner chooses when to anonymise |

Forms with their own "keep entries for" keep following it; the form entries rule covers the
others. Activity logs are the security log, webhook deliveries that aren't waiting to send, and
finished automation runs not about an entry. Privacy request records are never deleted by a
rule, and are left out of backups so a restore can't lose them.

## Plugins and add-ons

`personalData` in `definePlugin` (`personal-data-declaration.ts`) declares the tables and
columns that hold personal data, and the `find`, `export` and `erase` hooks. An add-on can
also declare its tables in the `lintel-addon` section of its package.json. A plugin or add-on
with tables but no hooks is listed as one that "can't be searched", so the owner knows to
look there by hand. `packages/plugin-example-bookings` is the example.

## Endpoints

All need `privacy:manage` (Owners and Admins). People are looked up with POST so their email
never appears in an address or a log.

| Method and path               | Body                | Success                                              |
| ----------------------------- | ------------------- | ---------------------------------------------------- |
| `GET /privacy/map`            | none                | 200 `{ kinds }`                                      |
| `POST /privacy/people/find`   | `{ email?, name? }` | 200 `{ found, notSearched }`                         |
| `POST /privacy/people/export` | `{ email?, name? }` | 200, a .zip                                          |
| `POST /privacy/people/erase`  | `{ email?, name? }` | 200 `{ parts }`                                      |
| `GET /privacy/requests`       | none                | 200 `{ requests }`                                   |
| `GET /privacy/retention`      | none                | 200 `{ rules }`                                      |
| `PUT /privacy/retention`      | any rules           | 200 `{ rules }`                                      |
| `GET /privacy/policy`         | none                | 200 `{ sections, draft, privacyPage, notMentioned }` |
| `GET /privacy/processors`     | none                | 200 `{ detected, added }`                            |
| `PUT /privacy/processors`     | `{ processors }`    | 200 `{ detected, added }`                            |

## Files

| File                           | What it does                                             |
| ------------------------------ | -------------------------------------------------------- |
| `personal-data-declaration.ts` | The shape plugins declare, and the hooks                 |
| `personal-data-sources.ts`     | Every kind of personal data, core and plugins            |
| `core-sources.ts`              | Lintel's own kinds and their rules                       |
| `personal-data.repository.ts`  | Finding and erasing in Lintel's own tables               |
| `personal-data-map.service.ts` | The map                                                  |
| `person-requests.service.ts`   | Find, export, erase, and the record of requests          |
| `personal-data-archive.ts`     | The export .zip                                          |
| `retention.service.ts`         | The rules, what's due, and running them                  |
| `retention.repository.ts`      | What each rule covers, in the database                   |
| `site-services.service.ts`     | What the site uses, for the policy helper and processors |
| `policy-helper.service.ts`     | The draft and the privacy page check                     |
| `processors.service.ts`        | Companies found and added                                |
| `privacy.repository.ts`        | Request records, and finding the privacy page            |
| `privacy.routes.ts`            | The endpoints                                            |
| `privacy.schema.ts`            | Zod schemas, settings and responses                      |
| `privacy.table.ts`             | `privacy_requests`                                       |
| `privacy.errors.ts`            | Named errors                                             |
| `privacy-test-server.ts`       | A server for the tests                                   |
