# Database

Which database Lintel uses, how it is opened, and what happens when it can't be reached.

## Which database

On start, the first of these that is set wins:

1. `DATABASE_URL`: a Postgres server named in the environment or the root `.env`.
2. `.lintel/config.json`: the database picked on the setup screen in the browser.
3. The built-in database: PGlite (Postgres compiled to WebAssembly), stored in
   `.lintel/data`. Nothing to install, so `pnpm install && pnpm dev` just works.

Both drivers are Drizzle `PgDatabase`s, so repositories are written once against the
shared `Database` type in `client.ts`. Why the built-in database is the default:
`docs/decisions/0005-built-in-database.md`.

Tables are created and updated (migrated) every time the server starts, and by every
command-line script, so nobody has to run migrations by hand.

The setup screen can switch the running server to another database without a restart.
That is why routes read `server.database` on every request: it comes from the
`ActiveDatabase`, which `switchTo` points somewhere new and closes the old connection.

## The built-in database's lock

Two programs writing to `.lintel/data` at once would corrupt it, and PGlite doesn't
prevent that. So whoever opens it writes their process id to `.lintel/data.lock` and
removes it on close. A second program (say `pnpm reset-password` while `pnpm dev` runs)
gets a plain "already in use" message. A lock left by a crashed program is taken over.

## Errors people can act on

`database-errors.ts` turns connection failures into one sentence plus what to do:
Postgres not running, unknown host, wrong password (`28P01`), refused user (`28000`),
missing database (`3D000`, with the exact `createdb` command) and an unreadable URL (with
how to %-encode `#`, `@` and `/`). The server, the scripts and the setup screen share it.

## Files

| File                   | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `client.ts`            | The shared `Database` type and `OpenedDatabase`                 |
| `active-database.ts`   | The database in use, switching it, and choosing one on start    |
| `built-in-database.ts` | Opening PGlite                                                  |
| `postgres-database.ts` | Opening Postgres, building URLs from fields, creating databases |
| `database-choice.ts`   | Reading and saving `.lintel/config.json`                        |
| `database-errors.ts`   | Plain-English connection errors                                 |
| `data-folder-lock.ts`  | One program at a time for the built-in database                 |
| `schema.ts`            | Every table, gathered from the feature folders                  |
| `columns.ts`           | Columns most tables share (`id`, `tenantId`, timestamps)        |

`dialect/` is the start of support for other databases. It changes nothing for Postgres;
see its README.
