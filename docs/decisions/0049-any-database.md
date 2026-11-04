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

## Status update, later on 2026-11-04: MySQL and MariaDB run

Status: **Lintel runs on MySQL 8.4 and MariaDB 11.4.** The server opens them, setup offers
them, and the whole core test suite passes on both. SQLite and SQL Server are as they were,
and the two open questions are still open. Everything above stands as it was written.

### Results

The same 2,252 tests on each database, on the last code commit, with other work sharing the
machine:

| Database          | Command              | Passed | Failed | Skipped |
| ----------------- | -------------------- | -----: | -----: | ------: |
| Built-in (PGlite) | `vitest run`         |  2,215 |      0 |      37 |
| Postgres 17       | `pnpm test:postgres` |  2,222 |      2 |      28 |
| MySQL 8.4         | `pnpm test:mysql`    |  2,212 |      1 |      39 |
| MariaDB 11.4      | `pnpm test:mysql`    |  2,213 |      0 |      39 |

All three failures were five-second timeouts while four test runs shared the machine, and each
passed alone afterwards: `site-effects.test.ts` on Postgres (21 of 21) and
`website-sites.test.ts` on MySQL (7 of 7, three times). One commit earlier, with the machine
quieter and no change to Lintel's own server code since, MySQL and MariaDB each passed 2,211 of
2,250 with none failed and 39 skipped. `pnpm test:dialects` passed 685, with 2 skipped.

Five tests that pass on the built-in database are skipped on MySQL, and two that only run on a
database server make up the difference. Of the five, four run a Postgres migration file that no MySQL install is old enough to
need. One is a built-in-only update test; its twin for a database server runs instead. Five
setup tests that need a real Postgres are skipped on MySQL, and
`mysql-start-up.dialects.test.ts` covers the same ground there.

While the suite runs on MySQL, a query on a table that didn't come through `tableFor` fails at
once (`refuse-postgres-tables-on-mysql.ts`), so a pass means Lintel's own code asked for the
right tables. Test files themselves get MySQL tables by a swap of their imports
(`use-mysql-tables-in-tests.ts`), which keeps 300 files unchanged.

| What                                   | Done | Of all |
| -------------------------------------- | ---: | -----: |
| Repositories moved                     |   92 |     97 |
| Query calls moved                      |  713 |    714 |
| Tables used only by moved repositories |   89 |     89 |
| Postgres-only items left, of 325       |   11 |    325 |

The other five "repositories" read and write files, and the one query call left is in one of
them. The 11 items are Postgres's own branch of backups and three `pg-core` imports that
don't query anything. 22 of the 92 have no `*.dialects.test.ts` naming each function: the whole
suite runs them through their services and routes, and how much of each it reaches wasn't
measured. `repositoriesRunByTheWholeSuite` lists them.

### What the suite found

Differences no reading of the code had caught:

- **Postgres's `now()` is one time for a whole transaction.** A new customer and their first
  order had the same time, and clearing test orders relied on that. On MySQL Node stamps each
  row, so the customer looked older than the order and was never cleared.
- **`exists` over `json_table` finds nothing** when it is the only condition on a join: MySQL
  makes it a semi-join. Finding a person by name in form answers came back empty. It counts
  instead now.
- **MariaDB's JSON functions give `utf8mb4_bin`,** as MySQL's do, so connections use it on both.
- **Emails go out after the response.** The built-in database's single connection hid that
  from tests; on a pool they can still be on their way. Nothing changes for visitors, and the
  test server now waits for them.

### Decisions made along the way

- **Connections use read committed,** as Postgres does, rather than MySQL's repeatable read. A
  read after waiting for a lock then sees the other writer's work, and deadlocks are rarer.
- **A lock that ends with its transaction is a row lock** in `lintel_locks`, a table only MySQL
  has. `get_lock` belongs to the connection, so a failed transaction could leave it held.
- **A transaction undone to break a deadlock is tried again,** up to four times. Single
  statements outside a transaction aren't.
- **JSON keys are written in jsonb's order,** so MariaDB, whose json is text, can compare two
  values with `<>`.
- **Search on MySQL isn't FULLTEXT.** That needs an index on a text column, and entries' values
  are JSON. Postgres's search has no stored index either, so neither is slower by design. Each
  word is looked for with `like` and `json_search`, which reads values and never keys. A word
  can match inside a longer word on MySQL, where on Postgres it must start one.
- **`dashboard_layouts_one_owner` stays left out.** The repository writes a person or a role,
  never both, but the database itself doesn't stop a row with both, as it does on Postgres.
- **MySQL 8.4 and MariaDB 11.4 are the stated minimums,** because those are what the suite ran
  on. Older ones get a warning in the server check, not a refusal.
- **A backup doesn't say which database it came from.** Tests move one from the built-in
  database to MySQL and back, on both engines.

### Add-ons

An add-on with no tables runs anywhere. One with tables stays off on MySQL and MariaDB unless
it names `mysqlMigrationsFolder`, and then it is promising that it gets each table through
`tableFor` and uses nothing only Postgres has. Nothing checks that promise. The bookings
example and the Newsletter and Instagram add-ons haven't made the move, so they stay off.

### What isn't proved

- A plugin that was on when a Postgres backup is restored into MySQL is kept out of its routes
  and the list, but its timed jobs and event handlers aren't stopped. They'd fail on missing
  tables, and the errors go to the log.
- On MariaDB, renaming a field with `json_set` can leave keys out of order. Two copies changed
  the same way still match, but one changed alone can show "unpublished changes" until it is
  published again.
- Nothing has run under real load, and the suite doesn't test many people at once beyond its
  own concurrency tests.
- MySQL 8.0, MariaDB 10.x and managed services with their own limits are untested.
- The Docker image hasn't been built with this change.

## Status update, end of 2026-11-04: closing the known limits

Status: **Lintel runs on MySQL 8.0.16 or newer and MariaDB 10.11 or newer, with Newsletter,
Instagram and the bookings example.** SQLite and SQL Server are as they were, and the two open
questions are still open. Everything above stands as it was written. The section "What isn't
proved" above is replaced by the one at the end of this one.

### Results

The whole core suite, on the last code commit. Each was run in a throwaway Docker container, with
other work sharing the machine. The numbers come from each run's own report.

| Database          | Command                | Passed | Failed | Skipped |
| ----------------- | ---------------------- | -----: | -----: | ------: |
| Built-in (PGlite) | `vitest run`, 3 shards |  2,749 |      0 |      51 |
| Postgres 17.11    | `vitest run`, 3 shards |  2,758 |      0 |      42 |
| MySQL 8.4.13      | `pnpm test:mysql`      |  2,761 |      0 |      39 |
| MariaDB 11.4.13   | `pnpm test:mysql`      |  2,760 |      1 |      39 |
| MySQL 8.0.46      | `pnpm test:mysql`      |  2,761 |      0 |      39 |
| MariaDB 10.11.19  | `pnpm test:mysql`      |  2,761 |      0 |      39 |

The one failure on MariaDB 11.4 was a five-second timeout in `starter-sites.test.ts` while five
other test runs shared the machine. That file passed 27 of 27 alone afterwards, and the whole suite
passed with none failed one commit earlier. The first run on the older two on this code had nine
failures, from "Deriving bits failed" and sign-ins answering 500: the machine had run out of memory
for hashing passwords, with over 100 Node processes on it. With two runs fewer beside it, both
passed as shown. The built-in and Postgres suites were split three ways by hand so they'd finish
on a busy machine: run whole, each had passed 30 minutes a third of the way through. `pnpm test:postgres` itself wasn't run.

| Other runs                                        | Result                                                      |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `pnpm test:dialects`, MySQL 8.4 and MariaDB 11.4  | 2,002 passed, 1 expected failure, 16 skipped                |
| The same, MySQL 8.0 and MariaDB 10.11             | 2,002 passed, 1 expected failure, 16 skipped                |
| `pnpm test:addons`, Postgres 17, 8.4 and 11.4     | Each server: 30 + 13 + 7 tests, then 4 from packed installs |
| The same, MySQL 8.0 and MariaDB 10.11             | The same, on each                                           |
| Migrations with `sql_require_primary_key` on, 8.4 | All 91 tables made                                          |

The expected failure is the built-in database's JSON text, under "What isn't proved".

### What changed, and why

- **Add-ons.** Newsletter, Instagram and the bookings example have `migrations-mysql`, get every
  table through `tableFor` and use the portable writes. `startPluginTestServer` now uses
  `TEST_DATABASE_URL`, so their own tests run on each server, and a query on a table that skipped
  `tableFor` fails there. `addons-packed.test.ts` builds each, packs it with npm, installs it with
  `lintel addons add` and runs it from the installed files. For that, the bookings example gained
  a `lintel-addon` section. A `bytea` custom column becomes `longblob`, and any other custom type
  stops with an error.
- **The promise is checked.** `lintel addons check` reads an add-on's server code with the same
  rules as core's own check (`postgres-only-rules.ts`), finds tables that skip `tableFor`, and
  compares its tables with its MySQL migrations. `lintel addons build` stops on the first two, and
  `lintel addons add` reads the bundle and warns. It warns rather than refuses, as a site on
  Postgres isn't harmed. The parser is handed in by the caller, so a running server never loads
  TypeScript. An add-on with no tables is held to it too, as nothing else keeps that one off.
  Reading can't see a query built as the code runs, so a site on MySQL still takes the author's
  word for what the check can't read. The add-on's tests on MySQL are the rest of it.
- **The scaffold** has no table, so it runs anywhere, and comes ready for one: both drizzle-kit
  configs, `mysql-schema.cjs`, the scripts, `migrations-mysql` in `files`, and a README section.
  We didn't add an example table, as its migrations would have to be written out in the template.
- **Search matches the start of words.** `json_search` and `like` can't see where a word starts,
  and a `regexp` over a whole JSON document can't skip keys without running into the server's
  regexp limits on a long page. So the database finds every candidate, and `search/word-starts.ts`
  decides, row by row, splitting text as Postgres's parser does: "example.com" is one word,
  "support-port" is three, and "2026-11-04" holds no "11". Rows are read a page at a time until
  the limit is met, so a search that matches inside many words and starts few reads more rows.
- **`isPluginRunning`** replaces the separate checks. A plugin that can't run here is left in the
  `enabledPlugins` setting, so it comes back on a move to Postgres, and nothing of it runs: routes,
  jobs, event handlers, Liquid tags, form consent, the Add-ons list and Privacy. `GET /auth/me`
  still lists it, so the admin can show its menu items, and they answer 404.
- **`jsonDiffers`** compares a page's saved and published values. MariaDB has `json_equals`, and
  MySQL's json compares by content, and neither has the other's. The two forms sit in executable
  comments, which each engine keeps or skips, so no code needs to know which engine it's on. Only
  columns go in, as a bound value can't sit in a comment.
- **Deadlock retries.** All 74 transactions in core were traced by a script following calls by
  name, and what it flagged was read by hand. Three could repeat something. Payment follow-ups were the
  serious one: they were collected in a list outside the transaction, so a retry kept the undone
  attempt's emails, events and tax records, naming an order that no longer existed. The bin's list
  of live entries did the same, and imported pictures were downloaded and stored inside their
  transaction. A backup writes to its archive inside one, and that stays, as a read-only snapshot
  takes no locks and can't be chosen to break a deadlock. `transactions-run-twice.test.ts` reads
  each callback's own code. It can't see into the functions a callback calls.
- **`dashboard_layouts_one_owner` is enforced.** Error 3823 forbids a check on columns with `on
delete` rules, and allows one on a generated column worked out from them. Migration 0003 is
  written by hand, adds a virtual `owner_count`, and checks it, on MySQL and MariaDB alike. Drizzle
  isn't told, so no query reads it, and `db:generate:mysql` sees no change. It mends any row that
  would break the check first, and a test runs it on a database stopped at 0002 with such rows.
- **Dialect tests for the last 22 repositories.** Every exported function is now called in a test
  in its own folder, and `repositoriesRunByTheWholeSuite` is empty, so all 92 are held to it. They
  found five bugs, listed in `docs/qa/FIX-LOG-mysql.md`, two of them on Postgres as well.

### Versions

The whole suite passed on MySQL 8.0.46 and MariaDB 10.11.19 with no change for those versions, so
**the stated minimums move down.** The first run on them had eight failures on each. All were in
the tests: five came from swapping tables in a dialect test, two from the server check warning
about the old minimum, and one from the check reading `@@foreign_key_checks` as full-text search.

MySQL's minimum is 8.0.16, because that is when it began to enforce checks, and migration 0003
needs them. Only 8.0.46 ran. MariaDB's is 10.11: `json_equals` needs 10.7, and 10.11 is the oldest
long-term version still looked after. Oracle's support for MySQL 8.0 has ended, so 8.4 is the one
to recommend. Older ones still get a warning in the server check, not a refusal.

### Managed services

None was run. This comes from what each says it offers, and is on the requirements page.

| Service                   | Expected   | Why                                                                                                                                                  |
| ------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amazon RDS MySQL, MariaDB | Should run | It lists MySQL 8.0 and 8.4, and MariaDB 10.11 and 11.4. Lintel uses no triggers, stored functions or `SUPER`, the usual trouble there.               |
| Aurora MySQL 3            | Likely     | It follows MySQL 8.0, but its storage and locking are Amazon's own.                                                                                  |
| DigitalOcean MySQL        | Should run | It keeps `sql_require_primary_key` on and users can't change it. Every Lintel table has a primary key: all 91 migrated with that setting on, on 8.4. |
| Cloud SQL, Azure MySQL    | Should run | For the same reasons as RDS.                                                                                                                         |
| PlanetScale               | No         | See below.                                                                                                                                           |

**PlanetScale matters here.** Foreign keys are off unless they're turned on for each database,
they work only on an unsharded one, and PlanetScale warns they slow busy databases down. Lintel
has 95 foreign keys and relies on their cascades to clear rows up, and creating a table with one
fails while they're off. Reports also say it refuses tables that point at each other, which
`users` and `assets` do. We didn't try it, and we don't offer it.

### Load

`pnpm test:load` runs a real server (`dist/main.js`) over HTTP against each database, in 60 seconds
after a 3-second warm-up. The site has 100 published pages. Viewers ask for pages and editors save
them with no pause at all, every fifth save publishes and every tenth goes to one shared page.

**50 viewers and 10 editors:**

| Database     | Kind       | In all | Per second | Median | 95% | 99% | Slowest | 409 | 5xx |
| ------------ | ---------- | -----: | ---------: | -----: | --: | --: | ------: | --: | --: |
| postgres:17  | Page views |  6,934 |        116 |    444 | 556 | 658 |     900 |   0 |   0 |
| postgres:17  | Saves      |  1,552 |         26 |    323 | 423 | 476 |     551 |  57 |   0 |
| postgres:17  | Publishes  |    308 |          5 |    323 | 407 | 448 |     508 |   0 |   0 |
| mysql:8.4    | Page views |  6,603 |        110 |    466 | 535 | 653 |     969 |   0 |   0 |
| mysql:8.4    | Saves      |  1,573 |         26 |    311 | 431 | 482 |     579 |  61 |   0 |
| mysql:8.4    | Publishes  |    312 |          5 |    320 | 434 | 453 |     543 |   0 |   0 |
| mariadb:11.4 | Page views |  7,035 |        117 |    440 | 519 | 649 |     902 |   0 |   0 |
| mariadb:11.4 | Saves      |  1,639 |         27 |    301 | 416 | 479 |     532 |  58 |   0 |
| mariadb:11.4 | Publishes  |    323 |          5 |    310 | 420 | 444 |     513 |   0 |   0 |

**200 viewers and 40 editors:**

| Database     | Kind       | In all | Per second | Median |  95% |  99% | Slowest | 409 | 5xx |
| ------------ | ---------- | -----: | ---------: | -----: | ---: | ---: | ------: | --: | --: |
| postgres:17  | Page views |  6,788 |        113 |   1946 | 2247 | 2569 |    3766 |   0 |   0 |
| postgres:17  | Saves      |  1,545 |         26 |   1352 | 1689 | 1830 |    2184 | 103 |   0 |
| postgres:17  | Publishes  |    281 |          5 |   1272 | 1544 | 1603 |    1667 |   0 |   0 |
| mysql:8.4    | Page views |  7,941 |        132 |   1574 | 1911 | 2311 |    3400 |   0 |   0 |
| mysql:8.4    | Saves      |  1,803 |         30 |   1105 | 1424 | 1594 |    1855 | 142 |   0 |
| mysql:8.4    | Publishes  |    360 |          6 |   1123 | 1397 | 1541 |    1582 |   0 |   0 |
| mariadb:11.4 | Page views |  8,187 |        136 |   1600 | 1901 | 2243 |    3559 |   0 |   0 |
| mariadb:11.4 | Saves      |  1,802 |         30 |   1140 | 1540 | 1698 |    1825 | 143 |   0 |
| mariadb:11.4 | Publishes  |    360 |          6 |   1106 | 1316 | 1372 |    1750 |   0 |   0 |

Times are in milliseconds, on one Windows machine with 16 cores, with Docker's databases holding
data in memory and the test sharing the machine.

- **The database wasn't what limited it.** All three served about the same, and going from 60 to
  240 people added waiting and hardly any throughput. One Node process drawing pages is the limit.
  So this shows MySQL and MariaDB keep up with Postgres at this size, not how far any can go.
- There were **no server errors, no failed connections and no deadlocks**, on any of them. That
  also means the retry itself didn't run under load: only `json-expressions.dialects.test.ts`
  makes a real deadlock.
- The 409s are saves refused because someone else's save got there first, which is how Lintel
  protects a page. They came at about the same rate on all three.

### What isn't proved

- No managed service has been run, and no MySQL 8.0 before 8.0.46 or MariaDB 10.11 before 10.11.19.
- A site on MySQL takes an add-on author's word for what `lintel addons check` can't read.
- Search's order is close to Postgres's and not the same: `ts_rank` counts how often and how near
  words are. Search reads rows into Node on MySQL, and how that behaves on a very large site
  hasn't been measured.
- `lintel addons check` and the transactions test read code. Neither follows every path.
- The load test used one server process, on one machine, with data in memory. It says nothing
  about disks, a network between the server and the database, or several server processes.
- On the built-in database, a jsonb value that is text holding valid JSON reads back parsed. It
  isn't new, and it's left alone, as Postgres and the built-in database were to stay as they are.
- The Docker image hasn't been built with this change.
