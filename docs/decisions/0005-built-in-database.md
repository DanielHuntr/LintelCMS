# 5. A built-in database by default

Date: 2026-10-31

## Decision

When `DATABASE_URL` is not set, Lintel uses PGlite (Postgres compiled to WebAssembly),
stored in `.lintel/data`. People can switch to their own PostgreSQL server on the setup
screen or with `DATABASE_URL`. Migrations run on every start.

## Why

The first person to try Lintel had to install Postgres or Docker, %-encode a password
into `.env`, run migrations by hand and create their account in a terminal. Each step
failed in a way that was hard to understand. With a built-in database, getting started
is `pnpm install` and `pnpm dev`, on Windows, macOS and Linux alike.

PGlite is real Postgres, not a look-alike, so the same schema, migrations and SQL run on
both. Repositories are written once against Drizzle's shared `PgDatabase` type and never
know which one they talk to. Tests use it too, so `pnpm test` needs nothing installed.

## Trade-offs

- PGlite serves one program at a time from one folder. Lintel keeps a lock file so a
  second program gets a clear message instead of corrupting the data, but it means
  stopping `pnpm dev` before running a script such as `reset-password`.
- It suits trying Lintel, development and small sites on one machine. Busy production
  sites should use a Postgres server, which is one setting away.

## Alternatives considered

- **SQLite**: no install either, but a different SQL dialect. Every query and migration
  would need two versions, and Postgres-only features (jsonb, arrays, advisory locks)
  would be off limits.
- **Requiring Docker**: works, but it is a large install for a first try and was one of
  the failures seen.
