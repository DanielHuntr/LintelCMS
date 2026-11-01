# Setup

The first-run setup screen's API. The screens collect every answer first (the database,
the owner's account, the site's name and kind) and only a final "Finish setup" saves
anything, with one request. Until the first user exists, these endpoints are open without
signing in, which is what lets a brand-new install be set up in the browser.

## Endpoints

| Method and path             | Body                                            | Success                                                                        |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /setup/status`         | none                                            | 200 `{ needsSetup, database, requiresSetupCode, siteSetupCompleted }`          |
| `POST /setup/database/test` | `{ host, port, database, user, password, ssl }` | 200 `{ ok: true }`                                                             |
| `POST /setup/finish`        | `{ database?, account, site }` (below)          | 201 `{ user, permissions, enabledPlugins, siteName }`, sets the session cookie |

`POST /setup/finish` takes:

```json
{
  "database": {
    "kind": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "lintel",
    "user": "postgres",
    "password": "…",
    "ssl": false,
    "createIfMissing": true
  },
  "account": { "name": "Ana Lopez", "email": "ana@example.com", "password": "…" },
  "site": { "siteName": "Brightside Bakery", "siteType": "shop" }
}
```

- `database` is `{ "kind": "built-in" }` or a Postgres server as above. Leave it out when
  `GET /setup/status` says `chosenBy: "environment"` (DATABASE_URL decided); it is ignored then.
- `siteType` is one of `business`, `blog`, `shop`, `portfolio`, `blank`. Every site gets Forms
  and SEO tools; the kind adds its own extras (`site-presets.ts`).
- `needsSetup` is true while there are no users at all. `database` in the status is
  `{ kind: "built-in" | "postgres", chosenBy: "environment" | "setup" | "default" }`.

## Finishing, in order

`finishSetup` (setup.service.ts) checks the password's strength, then switches to the chosen
database (testing it, creating it when `createIfMissing` is set, migrating it, saving the
choice in `.lintel/config.json`, readable only by its owner), then saves the owner's account
(Super admin), the site's name and kind, its features and a Pages collection (plus Blog posts
for a blog) in **one transaction**. A problem at any point leaves the rest unsaved, and
finishing again is safe.

## Errors

All errors use the usual `{ statusCode, code, error, message }` shape. Problems with an
answer also carry `step` (`"database"`, `"account"` or `"site"`), so the admin can take the
person back to that step, and `fields` (`{ password: "..." }`) when they are about fields.

| Status | `code`                                                                                   | When                                                            |
| ------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 400    | `INVALID_REQUEST`                                                                        | An answer is missing or wrong, or the password is easy to guess |
| 403    | `SETUP_CODE_REQUIRED`, `SETUP_CODE_INVALID`                                              | From another computer without the right setup code              |
| 409    | `SETUP_ALREADY_DONE`                                                                     | Someone already has an account; testing a DATABASE_URL database |
| 422    | `DATABASE_UNREACHABLE`, `DATABASE_AUTH_FAILED`, `DATABASE_NOT_FOUND`, `DATABASE_INVALID` | The Postgres server can't be used; `message` says why           |
| 429    | `TOO_MANY_SETUP_ATTEMPTS`                                                                | More than 10 tries a minute from one address, per endpoint      |

## Keeping strangers out

On a public server, anyone could reach these endpoints before you do. So any setup
request that doesn't come from the computer Lintel runs on needs the one-time setup code
printed in the terminal, sent in the `x-lintel-setup-code` header. It's compared in
constant time, and spaces and dashes don't matter. A request that came through a proxy
(any `X-Forwarded-For`, `Forwarded` or `X-Real-IP` header) counts as remote, even though
it arrives from 127.0.0.1. `requiresSetupCode` in the status says whether the current
request needs it.

## Safe against two people at once

`POST /setup/finish` checks for users and creates the first one inside one transaction holding a
Postgres advisory lock, so two simultaneous requests can't both become the first admin,
even across several server processes. Database changes and account creation also run
one at a time within a server.

## Choosing a database

The URL is built from the fields with the user and password %-encoded, so nobody has to
know about `%23`. See `src/database`.

## Files

| File                        | What it does                                            |
| --------------------------- | ------------------------------------------------------- |
| `setup.routes.ts`           | The endpoints, the setup-code guard and the rate limit  |
| `setup.service.ts`          | Status, and finishing setup with every answer           |
| `setup-database.service.ts` | Testing and choosing the database                       |
| `site-setup.service.ts`     | Saving the site's name, kind and features               |
| `site-presets.ts`           | The features each kind of site starts with              |
| `setup.schema.ts`           | Zod schemas for every request and response              |
| `setup.errors.ts`           | Named errors with the messages people see               |
| `setup.repository.ts`       | The advisory lock                                       |
| `setup-code.ts`             | Making and checking the code; telling local from remote |
