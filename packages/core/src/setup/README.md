# Setup

The first-run setup screen's API: choosing the database, creating the first admin, and
the "What are you building?" step. Until the first user exists, these endpoints are
open without signing in, which is what lets a brand-new install be set up in the browser.

## Endpoints

| Method and path             | Body                                                                                                         | Success                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `GET /setup/status`         | none                                                                                                         | 200 `{ needsSetup, database, requiresSetupCode, siteSetupCompleted }` |
| `POST /setup/database/test` | `{ host, port, database, user, password, ssl }`                                                              | 200 `{ ok: true }`                                                    |
| `POST /setup/database`      | `{ kind: "built-in" }` or `{ kind: "postgres", host, port, database, user, password, ssl, createIfMissing }` | 200 `{ database: { kind, chosenBy: "setup" } }`                       |
| `POST /setup`               | `{ email, name, password }`                                                                                  | 201 `{ user, permissions, enabledPlugins }`, sets the session cookie  |
| `POST /setup/site`          | `{ siteType, plugins }` (signed in, `settings:update`)                                                       | 200 `{ siteType, plugins }`                                           |

- `needsSetup` is true while there are no users at all.
- `database` is `{ kind: "built-in" | "postgres", chosenBy: "environment" | "setup" | "default" }`.
  `"environment"` means `DATABASE_URL` is set, so the admin skips the database step;
  `"default"` means nothing has been chosen and the built-in database is running.
- `siteType` is one of `business`, `blog`, `shop`, `portfolio`, `blank`. `plugins` are ids
  from `src/plugins`; the response lists every plugin with `enabled`, like `GET /plugins`.
  `/setup/site` can be called again later; it isn't limited to first run.

## Errors

All errors use the usual `{ statusCode, code, error, message }` shape.

| Status | `code`                                                                                   | When                                                                            |
| ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 400    | `INVALID_REQUEST`                                                                        | A field is missing or wrong (password under 12 characters...)                   |
| 403    | `SETUP_CODE_REQUIRED`, `SETUP_CODE_INVALID`                                              | From another computer without the right setup code                              |
| 409    | `SETUP_ALREADY_DONE`                                                                     | Someone already has an account, or the database step when `DATABASE_URL` is set |
| 422    | `DATABASE_UNREACHABLE`, `DATABASE_AUTH_FAILED`, `DATABASE_NOT_FOUND`, `DATABASE_INVALID` | The Postgres server can't be used; `message` says why                           |
| 429    | `TOO_MANY_SETUP_ATTEMPTS`                                                                | More than 10 tries a minute from one address, per endpoint                      |

## Keeping strangers out

On a public server, anyone could reach these endpoints before you do. So any setup
request that doesn't come from the computer Lintel runs on needs the one-time setup code
printed in the terminal, sent in the `x-lintel-setup-code` header. It's compared in
constant time, and spaces and dashes don't matter. A request that came through a proxy
(any `X-Forwarded-For`, `Forwarded` or `X-Real-IP` header) counts as remote, even though
it arrives from 127.0.0.1. `requiresSetupCode` in the status says whether the current
request needs it.

## Safe against two people at once

`POST /setup` checks for users and creates the first one inside one transaction holding a
Postgres advisory lock, so two simultaneous requests can't both become the first admin,
even across several server processes. Database changes and account creation also run
one at a time within a server.

## Choosing a database

`POST /setup/database` tests the connection (creating the database first, by connecting
to the `postgres` maintenance database, when `createIfMissing` is set), migrates it,
saves the choice in `.lintel/config.json` (readable only by its owner, since it holds the
password), and switches the running server to it. The URL is built from the fields with
the user and password %-encoded, so nobody has to know about `%23`. See `src/database`.

## Files

| File                        | What it does                                            |
| --------------------------- | ------------------------------------------------------- |
| `setup.routes.ts`           | The endpoints, the setup-code guard and the rate limit  |
| `setup.service.ts`          | Status and creating the first admin                     |
| `setup-database.service.ts` | Testing and choosing the database                       |
| `site-setup.service.ts`     | The "What are you building?" step                       |
| `setup.schema.ts`           | Zod schemas for every request and response              |
| `setup.errors.ts`           | Named errors with the messages people see               |
| `setup.repository.ts`       | The advisory lock                                       |
| `setup-code.ts`             | Making and checking the code; telling local from remote |
