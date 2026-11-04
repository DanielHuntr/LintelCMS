# 49. Any database: SQLite, MySQL / MariaDB and SQL Server next to Postgres

Date: 2026-11-03

Status: proposed

## The goal

Lintel should be open on databases. Today it runs on the built-in database (PGlite,
Postgres compiled to WebAssembly) and on a Postgres server. Daniel's decision is that it
should also run on **SQLite**, **MySQL / MariaDB** and **SQL Server**, from one codebase.

This record has four parts: what in Lintel is tied to Postgres today (the audit), how
Lintel can support all five with the least extra code (the design), a working proof on one
real feature, and a phased estimate with the risks.

## 1. Audit: what is tied to Postgres

Counted on `spike/any-database` (from `release/1.0.0-rc`) in `packages/core/src`.
"Non-test" means files that aren't `*.test.ts` or in `src/testing`.

### Tables

| What                                        | Count                                            | Notes                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `*.table.ts` files                          | 50                                               | All in core. Plugins bring their own migrations through `plugins/plugin-definition.ts`, which hands them a `PgTable`.                                        |
| Tables (`pgTable`)                          | 83                                               | 82 use `tenantId()`; the other is `user_roles`, a join table.                                                                                                |
| `id()` (uuid, `gen_random_uuid()`)          | 74 tables                                        | The id is made by Postgres. Ids must be made in Node on other dialects.                                                                                      |
| `timestamps()` (two timestamptz)            | 67 tables                                        | Plus 48 other `timestamp(..., { withTimezone: true })` columns in 25 files.                                                                                  |
| `uuid` columns                              | 109 in 39 files                                  | Mostly foreign keys.                                                                                                                                         |
| `jsonb` columns                             | 88 in 36 files                                   | Entry data, blueprints, menus, settings and so on. The biggest semantic difference.                                                                          |
| `text` / `integer` / `boolean`              | 270 / 79 / 24                                    | Portable, except that MySQL can't index `text` and SQL Server can't index `nvarchar(max)`.                                                                   |
| Arrays (`.array()`)                         | 5 in 4 files                                     | `sites.hostnames`, `roles.permissions`, `roles.site_ids` (uuid[]), `collections.site_ids` (uuid[]), `passkeys.transports`. They become JSON lists elsewhere. |
| `bigint`, `doublePrecision`, `real`, `date` | 1, 1, 2, 1                                       | Portable.                                                                                                                                                    |
| `pgEnum`, `serial`, identity                | 0                                                | Choices are `text` with `enum`, checked in TypeScript only. That makes porting easier.                                                                       |
| Unique indexes / indexes                    | 53 in 40 files / 69 in 31 files                  | None are partial, expression or GIN indexes.                                                                                                                 |
| Check constraints                           | 1 (`dashboard.table.ts`)                         | `(user_id is null) <> (role_id is null)`; that check works on SQLite and MySQL 8.0.16+ too.                                                                  |
| Foreign keys                                | 86 `references`, 81 with `onDelete`, in 38 files | SQL Server refuses "multiple cascade paths", so some cascades will have to be done by Lintel there.                                                          |
| Composite primary keys                      | 9 in 8 files                                     | Portable.                                                                                                                                                    |

### Queries

Lintel keeps to routes → service → repository, so nearly every query is in the
**86 `*.repository.ts` files**. One other file queries tables directly
(`importers/import-from-files.ts`). Services open transactions: 65 calls in 43 files.

| What (in repositories)                                                                              | Uses | Files | On other dialects                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ---: | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `select` / `selectDistinct`                                                                         |  341 |    76 | Same Drizzle call everywhere.                                                                                                                                      |
| `insert` / `update` / `delete`                                                                      |  287 |    61 | Same Drizzle call everywhere.                                                                                                                                      |
| `.returning()`                                                                                      |   98 |    52 | SQLite has it. MariaDB has it for insert and delete only, MySQL not at all, and SQL Server uses `OUTPUT`. Goes through `insertReturning` / `updateReturning`.      |
| `onConflictDoUpdate` / `onConflictDoNothing` (upserts)                                              |   41 |   ~30 | SQLite has the same. MySQL has `on duplicate key update`, which fires on _any_ unique key. SQL Server has only `MERGE`.                                            |
| Raw `sql` fragments                                                                                 |   95 |    31 | About 60 are Postgres-only; the list follows.                                                                                                                      |
| JSON field access `->>` / `->`                                                                      |   26 |    15 | SQLite 3.38+ has the same operators. MySQL needs `'$.title'` paths and SQL Server needs `JSON_VALUE`.                                                              |
| Casts `::int`, `::uuid`, `::jsonb`, `::text`, `::timestamptz`                                       |   47 |    15 | Postgres syntax; it becomes `cast(... as ...)` or disappears.                                                                                                      |
| `ilike`                                                                                             |   20 |     9 | Postgres only. Becomes `lower(x) like lower(y)` (see the case-sensitivity risk).                                                                                   |
| `count(*) filter (where ...)`                                                                       |    8 |     5 | SQLite has it. MySQL and SQL Server need `sum(case when ... then 1 else 0 end)`.                                                                                   |
| JSON containment `@>`                                                                               |    4 |     4 | `json_each` (SQLite), `JSON_CONTAINS` (MySQL), `OPENJSON` (SQL Server).                                                                                            |
| `jsonb_set`, `jsonb_exists`, `jsonb_typeof`, `jsonb_build_object`, `jsonb_array_elements_text`, `-` |    9 |     3 | Field renames and field changes (`entries/field-*.repository.ts`), and collection rules. Each dialect has its own JSON functions.                                  |
| JSON searched as text (`data::text like ...`)                                                       |   12 |     6 | Portable once the cast is per dialect, but jsonb's text form differs from what is stored on other dialects (see "JSON semantics").                                 |
| Array operations (`array_remove`, `= any`, `array_position`)                                        |    5 |     3 | Become JSON-list operations or app-side code.                                                                                                                      |
| Full-text search (`to_tsvector`, `to_tsquery`, `ts_rank`)                                           |    6 |     1 | `search/search.repository.ts`. SQLite has FTS5, MySQL has FULLTEXT, and SQL Server's Full-Text Search is an optional install. A `LIKE` fallback is needed.         |
| Advisory locks (`pg_advisory_xact_lock`)                                                            |    2 |     2 | `setup.repository.ts` and `forms/submissions.repository.ts`. SQLite has a single writer (`begin immediate`), MySQL has `GET_LOCK`, SQL Server has `sp_getapplock`. |
| `select ... for update`                                                                             |    5 |     4 | Checkout, discounts, inventory and orders. MySQL is the same and SQL Server uses `WITH (UPDLOCK)`. SQLite has no `for` in Drizzle, so it must be left out there.   |
| `selectDistinctOn`                                                                                  |    2 |     2 | Postgres only (webhooks, workflow runs). Becomes a window function or a grouped subquery.                                                                          |
| `nulls last`                                                                                        |    2 |     1 | SQLite has it. MySQL and SQL Server need `order by x is null, x`.                                                                                                  |
| `to_char ... at time zone`, `make_interval`                                                         |    2 |     2 | Sales by day and form retention. Become per-dialect date expressions or Node-side dates.                                                                           |
| `.execute()` with raw SQL                                                                           |    9 |     4 | Result shapes differ per driver (`rows` or an array).                                                                                                              |
| Transaction options                                                                                 |    1 |     1 | `backup-archive.service.ts`: `repeatable read, read only`.                                                                                                         |
| Postgres error codes (`23505` and so on)                                                            |    3 |     3 | `database-errors.ts`, `discounts.service.ts`, `media.service.ts`. Each dialect has its own codes.                                                                  |
| CTEs, window functions, `distinct on` in raw SQL, `generate_series`, `information_schema`           |    0 |     0 | None to port.                                                                                                                                                      |

### Infrastructure

| Where                                                                                                                     | What is Postgres-only                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `database/client.ts`                                                                                                      | `Database` is `PgDatabase`. `DatabaseKind` is `"built-in" \| "postgres"`.                                                                                                                                                                              |
| `database/built-in-database.ts`, `postgres-database.ts`, `active-database.ts`, `database-choice.ts`, `database-errors.ts` | Two openers, a setup choice that has only these two kinds, and plain-English errors keyed to Postgres codes.                                                                                                                                           |
| `database/migration-status.ts`, `health/health.repository.ts`                                                             | Read `drizzle.__drizzle_migrations`, which is in a Postgres schema. On other dialects it is `__drizzle_migrations` in the main database.                                                                                                               |
| `migrations/` (31 migrations, drizzle-kit 0.31, `dialect: "postgresql"`)                                                  | Postgres SQL. Every other dialect needs its own folder from the same tables.                                                                                                                                                                           |
| `backups/database-snapshot.repository.ts`, `table-order.ts`                                                               | Backups read rows with `json_agg(row_to_json(...))`, restore with `json_populate_recordset`, and empty tables with `truncate ... cascade`. The archive format (JSON rows per table) is already database-neutral; only the reading and writing are not. |
| `updates/supervisor/database-copies.ts`, `update-install.service.ts`                                                      | Roll-back copies the PGlite folder. On a Postgres server, one-click updates that change the database are refused.                                                                                                                                      |
| `testing/global-setup.ts`, `test-database.ts`                                                                             | A migrated PGlite template copied per test file (`dumpDataDir`), or `TEST_DATABASE_URL`. Tables are emptied with `truncate`. 122 test files use `useTestDatabase`, 25 query tables directly, and 3 import `pg-core` or PGlite.                         |
| `plugins/plugin-definition.ts`                                                                                            | The plugin API hands plugins `PgTable`s. That is a public API, so plugins will need the portable kit too.                                                                                                                                              |

### What the installed Drizzle supports

The installed versions are `drizzle-orm` 0.45.4 (the latest stable) and `drizzle-kit` 0.31.11.

| Dialect         | Query driver in 0.45.4                                                              | drizzle-kit 0.31            | Maturity                                                                                                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres        | `pglite`, `postgres-js`, `node-postgres` and others                                 | `postgresql`                | Stable; what Lintel uses.                                                                                                                                                                                                                                                                                      |
| SQLite          | `libsql`, `better-sqlite3`, `bun-sqlite`, `sql-js`, `sqlite-proxy`, `d1` and others | `sqlite`, `turso`           | Stable. `better-sqlite3` is ruled out: its transactions must finish synchronously, and Lintel's 65 transactions use async callbacks. It also needs a native build, which pnpm blocks here. **libSQL** has async transactions on a small pool of connections, prebuilt binaries and foreign keys on by default. |
| MySQL / MariaDB | `mysql2`, `planetscale-serverless`, `tidb-serverless`                               | `mysql` (and `singlestore`) | Stable. No `returning`.                                                                                                                                                                                                                                                                                        |
| SQL Server      | **None.** There is no `mssql-core` in 0.45.                                         | **None.**                   | Only in the **Drizzle 1.0 beta** (`1.0.0-beta.22`, April 2026; `beta.1` was November 2025), with `mssql` as a peer. It has been in beta for a year, and 1.0 also changes the migrations folder layout and relational queries. Not something to build a release on yet.                                         |

## 2. Design

### Options compared

| Option                                                                                          | Code to change                                                                                                                                                                                                                                | SQL Server                                | Migrations                                                                 | Type safety across dialects                                                                                                             |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Drizzle with portable table kits and a small dialect adapter** (recommended; proved below) | 50 table files rewritten mechanically. In repositories, one line per function (`table.for(database)`), plus about 140 Postgres-only call sites (returning, upserts, raw SQL) moved to helpers. The 628 ordinary query calls stay as they are. | When Drizzle 1.0 is stable; a fourth kit. | drizzle-kit generates a folder per dialect from the same tables, as today. | Postgres types for all dialects; differences are caught by each feature's dialect tests in CI, not by the compiler.                     |
| B. Drizzle, with each dialect's schema written by hand                                          | 83 tables × 3–4 dialects to keep in step by hand. Repositories still need one type, so it has the same typing problem as A.                                                                                                                   | Same as A.                                | Same as A.                                                                 | Same as A.                                                                                                                              |
| C. Kysely (one query builder, dialects chosen at run time)                                      | Rewrite all 628 query calls, 95 raw fragments, 65 transactions and the test helpers. About 8–12 weeks before any new dialect works.                                                                                                           | Stable now (`MssqlDialect` on tedious).   | Hand-written TypeScript migrations; no generator that compares tables.     | Types are dialect-neutral, but `returning` and upserts still compile and fail on the wrong dialect, so CI per dialect is needed anyway. |
| D. TypeORM / MikroORM / Prisma                                                                  | A rewrite of the data layer, and a heavier runtime. Prisma would add a generated client and a query engine to every install.                                                                                                                  | Yes                                       | Their own tools                                                            | Varies                                                                                                                                  |

**Recommendation: A.** It keeps every ordinary query as it is. Postgres tables and
migrations don't change, and the proof shows drizzle-kit agrees ("No schema changes"). It
needs no new query layer, and it adds dialects one feature at a time behind tests. Option
C buys SQL Server sooner, but only after the most expensive rewrite of the four and with
no migration generator. If SQL Server becomes urgent before Drizzle 1.0 is stable, the
fallback is option C for that dialect alone, and it's better to wait.

### (a) One table description, a table per dialect

`portableTable(name, (column) => ({ ... }), (table, column) => [indexes])` calls the
description once per dialect with a column kit (`database/portable/column-kits.ts`):

| Kit column    | Postgres             | SQLite                 | MySQL / MariaDB           | SQL Server (planned)                |
| ------------- | -------------------- | ---------------------- | ------------------------- | ----------------------------------- |
| `id()`        | uuid, random default | text, id made in Node  | varchar(36), from Node    | nvarchar(36), from Node             |
| `uuid`        | uuid                 | text                   | varchar(36)               | nvarchar(36) (not uniqueidentifier) |
| `text`        | text                 | text                   | text; varchar(64) if enum | nvarchar(max)                       |
| `indexedText` | text                 | text                   | varchar(255)              | nvarchar(255)                       |
| `integer`     | integer              | integer                | int                       | int                                 |
| `boolean`     | boolean              | integer 0/1            | boolean (tinyint)         | bit                                 |
| `json`        | jsonb                | text holding JSON      | json                      | nvarchar(max) holding JSON          |
| `timestamp`   | timestamptz          | integer, ms since 1970 | datetime(3), UTC          | datetime2(3), UTC                   |
| `textList`    | text[]               | JSON list              | JSON list                 | JSON list                           |

The Postgres kit returns exactly the builders the tables use today, so `sitesTable`
(now `sitesTables.postgres`) has the same type and the same SQL. Every other dialect's
table is typed as the Postgres one. That is the one deliberate type lie, made in one
place (`asColumnKit`, `portableTable`), and it is what keeps the 628 ordinary query calls
unchanged. The kits make every column hold the same TypeScript value on every dialect,
and per-dialect tests catch the rest.

### (b) The dialect adapter

`dialectOf(database)` reads what a database or transaction really is (Drizzle's `is()`).
A small set of helpers covers what differs:

| Helper                                       | Postgres / SQLite                           | MySQL / MariaDB                                                               | SQL Server                          |
| -------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------- |
| `insertReturning`, `updateReturning` (built) | `returning`                                 | Write, then read back by id in a transaction                                  | `OUTPUT inserted.*`                 |
| `deleteReturning`                            | `returning`                                 | Read, then delete, in a transaction                                           | `OUTPUT deleted.*`                  |
| `upsert(table, values, { target, set })`     | `on conflict`                               | `on duplicate key update` (only on tables with one unique key besides the id) | `MERGE`                             |
| `jsonText(column, key)`                      | `->>'key'` (SQLite takes the same)          | `->>'$.key'`                                                                  | `JSON_VALUE(col, '$.key')`          |
| `jsonContains(column, value)`                | `@>` / `json_each`                          | `JSON_CONTAINS`                                                               | `OPENJSON`                          |
| `containsIgnoringCase(column, text)`         | `ilike` / `lower() like lower()`            | `lower() like lower()`                                                        | `lower() like lower()`              |
| `countWhere(condition)`                      | `count(*) filter (where ...)`               | `sum(case when ... then 1 else 0 end)`                                        | same as MySQL                       |
| `lockForUpdate(query)`                       | `for update` (left out on SQLite)           | `for update`                                                                  | `WITH (UPDLOCK, ROWLOCK)`           |
| `transactionLock(key)`                       | `pg_advisory_xact_lock` / `begin immediate` | `GET_LOCK`                                                                    | `sp_getapplock`                     |
| `isUniqueViolation(error)`                   | `23505` / `SQLITE_CONSTRAINT_UNIQUE`        | `ER_DUP_ENTRY` (1062)                                                         | 2601 / 2627                         |
| `textSearch(...)`                            | tsvector / FTS5                             | FULLTEXT                                                                      | Full-Text if installed, else `LIKE` |

`now()`: timestamps are written by Node (`$defaultFn`) on every dialect, and each
dialect's own `now` stays only as the column default for raw inserts. Ids are made by
Node (`randomUUID`) everywhere except Postgres, which keeps its `gen_random_uuid()`
default so existing installs see no change.

A lint rule bans the Postgres-only names (`ilike`, `selectDistinctOn`, `drizzle-orm/pg-core`
outside `*.table.ts`, `::` casts in `sql`) in repositories that have been ported.

### (c) tenantId and existing data

`tenantId()` stays `text` with `'default'`. It is varchar(64) on MySQL and nvarchar(64)
on SQL Server, so it can lead every composite index as it does now (see 0003). Existing
Postgres and PGlite installs are untouched: same tables, same migrations, same ids. Moving
an install between dialects goes through the backup archive. Its format is already JSON
rows per table, so once reading and restoring are written in Drizzle rather than
`row_to_json`, a backup taken on PGlite restores into MySQL. That gives "move my site to
another database" without a separate tool.

### (d) Tests on every dialect

- Each ported feature gets a `*.dialects.test.ts` that runs its repository on every
  available dialect. Locally that is **PGlite and SQLite**, with nothing to install. MySQL
  runs when `TEST_MYSQL_URL` is set, and SQL Server later when `TEST_MSSQL_URL` is set.
- The service and route tests (122 files on `useTestDatabase`) gain a
  `TEST_DATABASE_DIALECT` switch once all their tables are portable. `emptyAllTables`
  becomes deletes in foreign-key order (no `truncate cascade`), and the SQLite template is
  a migrated file copied per test file, like PGlite's `dumpDataDir` today.
- CI runs a matrix with PGlite, Postgres 16, SQLite, MySQL 8.4, MariaDB 11.4, and later
  SQL Server 2022. It also checks that `db:generate`, `db:generate:sqlite` and
  `db:generate:mysql` each report no changes, so no one forgets a dialect's migration.

### (e) Backups, updates and going back

| Database               | Lintel's backup (archive) | Copy kept for a failed update or roll back                                                                                      | One-click updates that change the database          |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Built-in (PGlite)      | Yes (as now)              | The data folder (as now)                                                                                                        | Yes (as now)                                        |
| SQLite file            | Yes                       | The file, copied by the supervisor while no server runs (after a WAL checkpoint), or `VACUUM INTO`                              | Yes                                                 |
| Postgres server        | Yes                       | None: Lintel can't copy a server                                                                                                | Refused, as now; docs point to `pg_dump`            |
| MySQL / MariaDB server | Yes                       | None. Also, MySQL schema changes can't be rolled back inside a transaction, so a failed migration can leave tables half-changed | Refused; docs point to `mysqldump` / `mariadb-dump` |
| SQL Server             | Yes                       | None                                                                                                                            | Refused; docs point to `BACKUP DATABASE`            |

Lintel doesn't run dump tools itself: they may not be installed, and their versions must
match the server. The app-level archive is the portable backup everywhere.

### (f) Setup screen and configuration

`DATABASE_URL` picks the dialect from its scheme:

| Scheme                             | Database                               |
| ---------------------------------- | -------------------------------------- |
| (none set)                         | Built-in database (PGlite), as now     |
| `postgres://`, `postgresql://`     | Postgres                               |
| `sqlite:./path/lintel.db`, `file:` | SQLite file                            |
| `mysql://`, `mariadb://`           | MySQL or MariaDB (both through mysql2) |
| `sqlserver://`, `mssql://`         | SQL Server (later)                     |

The setup screen keeps it calm. "Built-in (recommended)" stays first and selected, then
"PostgreSQL". "MySQL or MariaDB", "SQLite file" and later "SQL Server" sit under
**Use another database**. Each asks only for host, port, name, user, password and SSL (or
a file for SQLite), and gets the same plain-English connection errors as Postgres. The
error codes are mapped per driver in `database-errors.ts`. Switching to SQLite or MySQL
restarts the server rather than switching live, because a running server's tables are
built for one dialect. The setup screen says so in one line.

## 3. Proof: site fonts on PGlite, SQLite, MySQL and MariaDB

Built on this branch, with the rest of Lintel left as it is:

- `src/database/portable/`: `database-dialect.ts`, `column-kits.ts` (Postgres, SQLite and
  MySQL kits), `portable-table.ts`, `portable-queries.ts` (`insertReturning`,
  `updateReturning`), `open-portable-database.ts` (libSQL and mysql2 openers and
  migrators), `sqlite-schema.ts` and `mysql-schema.ts` for drizzle-kit, and a README.
- `sites.table.ts` and `site-fonts.table.ts` are now `portableTable`s. `sitesTable` and
  `siteFontsTable` are still exported as the Postgres tables, so nothing else changed.
  `pnpm db:generate` reports **no schema changes** for Postgres.
- `drizzle.sqlite.config.ts`, `drizzle.mysql.config.ts`, `pnpm db:generate:sqlite` and
  `db:generate:mysql`, and the first migration in each of `migrations-sqlite/0000_…` and
  `migrations-mysql/0000_…`.
- `site-fonts.repository.ts` takes the table for the database it is given and uses the
  two helpers. Its eight functions are otherwise unchanged.
- `site-fonts.dialects.test.ts`: 12 tests per dialect. They cover defaults (id, tenant,
  JSON, time), JSON and time round trips, case-insensitive family lookup, the unique index
  per site, a refused foreign key, update-and-return, ordering, Adobe project removal,
  cascade on site delete, transaction rollback, and a site's list and JSON columns.

Results: **36 of 36 pass** on PGlite, SQLite (libSQL) and MySQL 8.4. MariaDB 11.4 also
passes, with 36 of 36 when it takes MySQL's place. MySQL and MariaDB ran in throwaway
Docker containers through `TEST_MYSQL_URL`; without it, PGlite and SQLite run (24 tests).
The existing site-fonts and sites tests still pass on PGlite (101 tests in 11 files).

What the proof found:

- libSQL turns on foreign keys for every connection by default, so cascades work with no
  set-up. Plain SQLite drivers leave them off.
- MySQL needs `varchar` for indexed text and for text with a default. The kit's
  `indexedText` and its `enum` mapping handle both, and drizzle-kit's MySQL output for
  text defaults (`DEFAULT ('')`) needs MySQL 8.0.13+ or MariaDB 10.2+.
- Timestamps round-trip to the millisecond on all three once MySQL connections use UTC
  (`set time_zone = '+00:00'` on each new connection).
- `update` with nothing to set throws "No values to set" on every dialect, the same as
  before.

## 4. Estimate and phases

Effort is for one developer who knows the codebase, in focused weeks. It includes the
dialect tests and docs. The ranges are wide on purpose: most of the risk is in behaviour,
not in syntax.

| Phase                               | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Effort                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 0. Foundation (the proof, finished) | The rest of the helpers in (b), the lint rule, a dialect switch for `useTestDatabase` and a SQLite template, `emptyAllTables` without `truncate`, the CI matrix, and a portable kit in the plugin API.                                                                                                                                                                                                                                                                                            | 1–2 weeks                   |
| 1. SQLite                           | Port the other 81 tables (mechanical; about a day per 10–15 tables, plus review). Move the ~60 Postgres-only fragments to helpers: JSON field changes and renames, search (FTS5 with a `LIKE` fallback), arrays as JSON lists, and the advisory locks. Rewrite backup read and restore in Drizzle. Fix the migration status and health checks. Add the opener, the setup choice, the URL schemes and the supervisor's file copy for roll-back. Get all 122 database test files passing on SQLite. | 5–7 weeks                   |
| 2. MySQL / MariaDB                  | Route the 98 `returning` calls and 41 upserts through helpers, and check each upsert's table has one unique key. Settle collation (see risks), JSON paths, FULLTEXT search, `GET_LOCK`, error codes, the setup screen and docs. Run the whole suite on MySQL 8.4 and MariaDB 11.4.                                                                                                                                                                                                                | 3–5 weeks                   |
| 3. SQL Server                       | Wait for Drizzle 1.0 to be stable. Upgrade every dialect to it (new migrations layout, relational queries v2 for the 9 `.query.` uses): 1–2 weeks. Then a fourth kit, `OUTPUT` and `MERGE`, cascades Lintel does itself where SQL Server refuses them, `JSON_VALUE` / `OPENJSON`, `TOP`/`OFFSET` (which need an `order by`), chunking the large `in (...)` lists (2,100-parameter limit), `sp_getapplock`, and search without Full-Text.                                                          | 5–8 weeks after Drizzle 1.0 |

The total is about **3–3.5 months for SQLite plus MySQL / MariaDB**, then about
**1.5–2.5 months for SQL Server**, starting when Drizzle 1.0 is stable. Every feature
built afterwards costs a little more: three or four migrations per table change and
four or five databases in CI.

### Risks: behaviour that differs

- **Case sensitivity and collation.** Postgres compares text exactly. MySQL's default
  `utf8mb4_0900_ai_ci` ignores case _and accents_, so "Lora" and "lora" would collide in
  the unique index, and "é" would match "e". SQL Server's default `..._CI_AS` ignores case.
  Plan: create MySQL tables with `utf8mb4_bin` (MariaDB: `utf8mb4_bin`) and SQL Server
  columns with a `_BIN2` / `_CS_AS` collation, so Lintel behaves the same everywhere. Make
  case-insensitive matching explicit with `lower()`. SQLite's `lower()` and `LIKE` only
  fold ASCII, so "É" ≠ "é" there; such checks should also compare in Node for non-ASCII
  names.
- **JSON semantics.** jsonb reorders keys and drops duplicates; SQLite and SQL Server keep
  the text as written. Two places compare `data <> published_data` to show "unpublished
  changes", and those would see a change where only key order differs. Plan: write JSON
  with a stable key order, or compare in Node. Searching JSON as text is also affected,
  because jsonb's text form puts spaces after `:` and `,`.
- **Transactions and locks.** SQLite has one writer at a time, so busy writers need a
  `busy_timeout` and short transactions. MySQL's REPEATABLE READ takes gap locks and
  deadlocks more often on inserts with unique keys, so services need a retry on deadlock
  (1213). SQL Server blocks readers unless READ_COMMITTED_SNAPSHOT is on, which should be
  required in the docs. The backup's `repeatable read, read only` is mapped per dialect.
- **Index and key limits.** MySQL keys are at most 3,072 bytes, which is 768 utf8mb4
  characters across a composite index. SQL Server keys are at most 900 bytes clustered or
  1,700 non-clustered, at 2 bytes a character. Every `indexedText` length must be checked
  against its index.
- **`returning` vs `OUTPUT`.** MySQL has neither. The read-back helpers need ids made in
  Node, and that is already in the kits. SQL Server's `OUTPUT` doesn't work on tables with
  triggers, which Lintel doesn't use.
- **Upsert semantics.** MySQL's `on duplicate key update` fires on any unique key, not a
  chosen one. On a table with two unique keys it can update the wrong row.
- **Time zones.** Lintel stores UTC everywhere. MySQL's `datetime` has no zone, so
  connections must use UTC. SQL Server's `datetime2` likewise. SQLite stores milliseconds.
- **Schema changes are not transactional on MySQL**, so a migration that fails half way
  leaves half-changed tables. That's another reason one-click updates that change the
  database are refused on servers.
- **Drizzle 1.0 for SQL Server** has been in beta for a year. Its release date and the
  upgrade's breaking changes are outside Lintel's control.
- **Ongoing cost.** Every future table and query has to work on four or five databases.
  Plugins get the same rules.

### What users would see

- **Setup:** "Built-in (recommended)" stays the default, and PostgreSQL stays next to it.
  "MySQL or MariaDB", "SQLite file" and (later) "SQL Server" sit under **Use another
  database**, with the same short connection form and plain-English errors.
- **Docs:** a "Choosing a database" page. It says the built-in database suits one site on
  one machine, and gives Postgres, MySQL / MariaDB or SQL Server for agencies whose host
  already runs one. It lists the minimum versions (Postgres as today, MySQL 8.0.13, MariaDB 10.5,
  SQL Server 2019) and the collation settings. It also explains that one-click updates
  which change the database ask for a backup by hand on a database server.
- **Moving between databases:** make a backup, set up the new database, restore it.

## Open questions for Daniel

1. Should SQLite be offered as a separate choice, or only kept for hosts where PGlite
   can't run? PGlite already gives a no-install database, so SQLite mostly helps people
   who want a single file they can open with other tools.
2. Is it acceptable to build SQL Server only once Drizzle 1.0 is stable, rather than
   adding a second query layer for it now?

## Status update, 2026-11-04

Status: **MySQL and MariaDB approved as the next database; work started. Nobody can run
Lintel on them yet.** SQLite and SQL Server stay proposed, and the two open questions
above are still open. Everything above is left as it was written on 2026-11-03.

What was taken from the spike on `spike/any-database` (commit 288818c), and what wasn't:

- Taken: the audit, the idea of one dialect check and a small set of helpers, ids made in
  Node on MySQL, read-back in place of `returning`, a test per feature on each database,
  and a separate migrations folder.
- Not taken: `portableTable` and the column kits. They would rewrite all 54 `*.table.ts`
  files while other work is changing them. MySQL tables are now worked out from the
  Postgres tables instead, so the table files don't change at all (see below).
- Not taken yet: SQLite, libSQL and its migrations. MySQL and MariaDB come first.

Sections below this line are added as the work moves on.

### Recount on release 9943c3c1, 2026-11-04

The audit above was counted on an older release. Counted again by the check in
`src/testing/postgres-only-code.ts`, which reads the source, so comments don't count. The
two days' numbers for query calls were counted in different ways, so that row is a guide.

| What                        | 2026-11-03 | 2026-11-04 |
| --------------------------- | ---------: | ---------: |
| Tables                      |         83 |         89 |
| Table files                 |         50 |         54 |
| Repositories                |         86 |         95 |
| Query calls in repositories |        628 |        708 |
| `returning`                 |         98 |        118 |
| Upserts                     |         41 |         42 |

Counting every kind of Postgres-only item once, wherever it is, there were 325 in 89 files
before any moved. That number includes `returning` and upserts, so it isn't comparable with
the "about 60" raw fragments above.

### What was built

- `src/database/dialect/`: one place that says which database is in use and what it can
  do, with helpers for `returning`, upserts, insert-if-new, JSON, lists of ids,
  case-insensitive matching, counting, ordering and date maths. On Postgres each gives the
  query Lintel already ran, so Postgres and PGlite behave as before.
- **MySQL tables are worked out from the Postgres tables** (`mysql-tables.ts`), rather than
  each table being rewritten as a `portableTable`. All 89 tables have a MySQL form, created
  by one migration in `migrations-mysql`. `pnpm db:generate` still reports no changes, and
  no table file or Postgres migration was touched. A new column reaches MySQL with no extra
  code. The cost is that a repository has to ask for its table with `tableFor`.
- `src/testing/postgres-only-code.test.ts`: fails on new Postgres-only code outside the
  dialect layer, using a list of what's left that can only shrink.
- `pnpm test:dialects`: runs every `*.dialects.test.ts` on the built-in database, MySQL 8.4
  and MariaDB 11.4 in throwaway Docker containers. Ordinary `pnpm test` runs the same files
  on the built-in database alone and needs no Docker.
- `pnpm dialect:report`: the counts below, read from the source.

### What changed from the plan above, and why

- **`text` is `longtext`, not `text`.** MySQL's `text` stops at 64 KB and Postgres has no
  limit, so the proof's column kit would have refused long values.
- **The collations are `utf8mb4_0900_bin` (MySQL) and `utf8mb4_nopad_bin` (MariaDB), not
  `utf8mb4_bin`.** `utf8mb4_bin` ignores trailing spaces, so "Lora" and "Lora " would clash.
  MySQL's JSON functions return `utf8mb4_bin` and refuse to compare it with text in the
  column collation, so MySQL connections use `utf8mb4_bin` while the columns stay exact.
- **JSON is read as text and parsed by the column.** Drizzle's own MySQL JSON column does no
  parsing, which MariaDB needs, and the driver's parsing can't tell the stored text "123"
  from the number.
- **`insert ignore` isn't used for insert-if-new.** A plain insert and a caught duplicate
  error keep Postgres's meaning: other errors still surface, and so does a clash on a
  different key from the one named. `insert ignore` would hide both.
- **`dashboard_layouts_one_owner` is left out on MySQL.** MySQL refuses a check on columns
  with `on delete` rules (error 3823). The service that writes those rows still enforces it.
- **Timestamps with a `now()` default are set in Node on MySQL too,** so a row's times come
  from one clock.

### Which features run on which database

Postgres and the built-in database run everything, as they always have. **MySQL and MariaDB
run nothing a person can use yet: the server can't open them.** What is proved is at the
repository level. Each repository below has no Postgres-only code left, gets every table
through `tableFor`, and has every exported function run on MySQL 8.4 and MariaDB 11.4 by a
`*.dialects.test.ts`. Their services and routes have not been run on MySQL.

| Area                  | Repositories moved                                                             |
| --------------------- | ------------------------------------------------------------------------------ |
| Sites                 | sites, locales, site fonts                                                     |
| Settings              | settings, interface languages                                                  |
| Signing in and people | users, roles, sessions, one-time tokens, two-factor, passkeys, invitations     |
| Security and access   | security log, API tokens, apps                                                 |
| Content model         | blueprints, fieldsets, collections, taxonomies, terms, global sets and values  |
| Other                 | redirects, dashboard layouts, webhooks and deliveries, forms (not submissions) |
| Shop                  | sales summary, markets, shop settings                                          |

Counts on 2026-11-04, from `pnpm dialect:report` and the list of what's left:

| What                                   | Done | Of all |
| -------------------------------------- | ---: | -----: |
| Repositories moved                     |   30 |     95 |
| Query calls moved                      |  206 |    708 |
| Tables with a MySQL form and migration |   89 |     89 |
| Tables a moved repository uses         |   34 |     89 |
| Tables used only by moved repositories |   11 |     89 |
| Postgres-only items removed            |   78 |    325 |

Not moved, and not simple:

- Entries, the content tree, delivery and GraphQL: JSON field changes and renames
  (`jsonb_set`, `jsonb_exists`), `data <> published_data`, and sorting by a JSON field.
  MariaDB's json is text, so comparing it depends on key order where jsonb's doesn't.
- Search: full-text search has no helper yet.
- Form submissions and setup: advisory locks have no helper yet. `GET_LOCK` belongs to the
  connection rather than the transaction, so it needs more than a swapped call.
- Backups: reading and restoring through `row_to_json`, and `truncate ... cascade`.
- Everything the server does on start: the opener, the setup screen, migration status,
  health checks and connection errors are all Postgres-only.
- Plugins: their tables and migrations are Postgres-only.

### Estimate of what's left

For one developer who knows the codebase, in focused weeks: **about 6 to 9 weeks**.

| Work                                                                         |   Weeks |
| ---------------------------------------------------------------------------- | ------: |
| The other 65 repositories, of which about 40 are mechanical like the 30 done | 1.5 – 2 |
| Entries, content tree, field changes, search, submissions, privacy, backups  |   2 – 3 |
| Opening MySQL in the server: start-up, setup screen, errors, health, status  |       1 |
| The whole test suite on MySQL (a switch in `useTestDatabase`), and its fixes | 1.5 – 3 |
| Plugins, docs and the setup choice                                           |    ~0.5 |

Most of the risk is in the fourth row. The existing tests have never run on MySQL, and that
is where differences in ordering, locking and deadlocks will show up. Until that row is
done, nothing should tell people that MySQL works.

### Later on 2026-11-04

The sections above stand as written. These are the numbers and findings since.

**Still true: MySQL and MariaDB run nothing a person can use.** The server can't open them,
and services and routes haven't run on them. The repository-level rules are the same as
above.

| What                                   | Done | Of all |
| -------------------------------------- | ---: | -----: |
| Repositories moved                     |   70 |     95 |
| Query calls moved                      |  475 |    710 |
| Tables with a MySQL form and migration |   89 |     89 |
| Tables a moved repository uses         |   78 |     89 |
| Tables used only by moved repositories |   44 |     89 |
| Postgres-only items removed            |  164 |    325 |

Four of the 95 "repositories" read and write files rather than the database, so they need no
move. Also moved since the table above: workflows and runs, approvals, notifications,
revisions, scheduled entries, entry publishing, SEO, menus, content roots, GraphQL reads,
content model reads, publishing, the file export's reads, carts, checkouts, products,
product collections, shipping, payment accounts, the media bin, backups' list, visitor
counts, A/B tests, site and WordPress imports, client reviews, privacy requests, blocks, customers, clearing test orders.

Not moved: entries, the content tree, delivery, search, field changes and renames, form
submissions, the recycle bin, media, orders, refunds, discounts, inventory, the
Shopify import, personal data, setup, health and the backup archive itself. A moved
repository can still be handed conditions from code that hasn't moved: `listProductRows`
takes one from `product-collection-rules.ts`, which is Postgres-only.

New on MySQL, found by the tests:

- An insert can't read from its own table (error 1093), and MariaDB gives a misleading null
  error for the same query. `capabilitiesOf` says so, and the workflow log counts first.
- A raw `sql` value holding JSON comes back as text, so `jsonValue` parses it.
- MariaDB has no `for update of`, which `inventory.repository.ts` uses. That is one reason
  it hasn't moved.

**The whole core suite has now run on a real Postgres 17 server** (`pnpm test:postgres`), not
just the built-in database. Migrations pass on an empty database, and on one stopped at 0031
with rows in it, which ends up with the same tables and keys and keeps its rows.

It found one real bug. Any discount code with a usage count failed with a 500 on a Postgres
server, because a plain Date went into raw SQL: the built-in database accepts that and the
server's driver doesn't. The query is fixed, and the Postgres-only check now refuses a date
in raw SQL. It also found that a content model sync still running could write after the
server had closed, and that one update test assumed the built-in database. A row's created
and updated times on a Postgres server come from two clocks, so an update can look a few
milliseconds older than the row. That was already so, and it's left as it is.

The estimate above was about 6 to 9 weeks. With the mechanical repositories nearly done,
about **5 to 7 weeks** remain, and the risk is where it was: the whole suite on MySQL.
