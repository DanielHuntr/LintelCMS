# Database dialects

The one place that knows Lintel can run on more than one kind of database: Postgres (the
built-in database and a Postgres server), MySQL 8.4 and MariaDB 11.4. `pnpm test:mysql` runs
the whole core suite on the last two. The history and the state of it are in
`docs/decisions/0049-any-database.md`.

Nothing here changes Postgres. Every helper gives the same query Lintel ran before, and the
`*.table.ts` files and `migrations` folder are not touched.

## How a table reaches MySQL

The `pnpm` commands here are run in `packages/core`.

The `*.table.ts` files stay the only description of a table. `mysql-tables.ts` works out
each table's MySQL form from its Postgres table (the types are listed at the top of that
file), so a new column needs no extra code. It stops with an error on a column type or
default it doesn't know.

`pnpm db:generate:mysql --name <what_changed>` writes the migration to `migrations-mysql`.
`pnpm test:dialects` fails if you forget. Run it after `pnpm db:generate` whenever a table
changes. A plugin's tables aren't included: a plugin brings its own MySQL migrations, or stays
off there (see "Running on MySQL and MariaDB" in the plugin docs). `lintel addons check` holds
a plugin that brings them to the same rules as Lintel's own code, and `pnpm test:addons` runs
Lintel's own add-ons on Postgres, MySQL and MariaDB, from their source and from a packed install.

## How a repository moves over

Three small changes, and every ordinary query stays as it is:

```ts
import { siteFontsTable as siteFontsDefinition } from "./site-fonts.table.js";

export async function listSiteFontRows(database: DatabaseOrTransaction, tenantId: string) {
  const siteFontsTable = tableFor(database, siteFontsDefinition);
  return database.select().from(siteFontsTable).where(eq(siteFontsTable.tenantId, tenantId));
}
```

1. Import each table under another name, and get it with `tableFor` at the top of each
   function. A column carries how its values are written and read, so MySQL needs its own.
2. Replace what only Postgres has, using `writes.ts` and `expressions.ts`.
3. Add a `*.dialects.test.ts` using `describeOnEveryDatabase`, and add the repository to
   `src/testing/mysql-ported-repositories.ts`.

| Instead of                               | Use                                                 |
| ---------------------------------------- | --------------------------------------------------- |
| `.insert().values().returning()`         | `insertReturning(database, table, values, fields?)` |
| `.update().set().where().returning()`    | `updateReturning(database, table, set, where)`      |
| `.delete().where().returning()`          | `deleteReturning(database, table, where)`           |
| `.onConflictDoUpdate({ target, set })`   | `upsert(database, table, values, { target, set })`  |
| `.onConflictDoUpdate().returning()`      | `upsertReturning(database, table, row, options)`    |
| `.onConflictDoNothing()`                 | `insertIfNew`, or `insertIfNewReturning`            |
| `data->>'title'`, `data -> 'design'`     | `jsonText`, `jsonValue`                             |
| `tags @> '["sale"]'`                     | `jsonListIncludes`                                  |
| `data::text`                             | `jsonAsText`                                        |
| `= any(ids)`, `array_remove(ids, id)`    | `idListIncludes`, `idListWithout`                   |
| `ilike`                                  | `likeIgnoringCase`                                  |
| `count(*) filter (where ...)`            | `countWhere`                                        |
| `selectDistinctOn`, newest of each group | `selectNewestPerGroup` (in `reads.ts`)              |
| `sum(...) filter (where ...)`            | `sumWhere`                                          |
| `branch->'entries'->0->>'siteId'`        | `jsonTextAt`                                        |
| `jsonb_exists`, `jsonb_typeof`           | `jsonHasKey`, `jsonIsObject`                        |
| `jsonb_set`, moving a key                | `jsonWithKey`, `jsonWithKeyRenamed`                 |
| `jsonb_build_object` of some keys        | `jsonOnlyKeys`                                      |
| `jsonb_each_text`, a whole value         | `jsonObjectHoldsText`                               |
| `array_position`                         | `positionInList`                                    |
| full-text search                         | `textSearch`                                        |
| `pg_advisory_xact_lock`                  | `holdLockUntilTransactionEnds`                      |
| `for update of table`                    | `.for("update", lockOnly(database, table))`         |
| `database.execute` and reading its rows  | `readRawRows`                                       |
| `nulls last`                             | `orderNullsLast`                                    |
| `to_char(... at time zone 'UTC', ...)`   | `utcDay`                                            |
| `... - make_interval(days => ...)`       | `daysBefore`                                        |
| checking for error code `23505`          | `isUniqueViolation`, in `../database-errors.ts`     |

## The one type lie, and what keeps it honest

Repositories are typed against the Postgres `Database` and tables, even when they are given
MySQL ones. Typing them twice would double every repository. So the compiler won't stop a
repository using something only Postgres has. Two tests do instead:

- `src/testing/postgres-only-code.test.ts` reads the source and fails on anything
  Postgres-only outside this folder that isn't already on its list. The list can only
  shrink: when you remove something, run `pnpm dialect:baseline`.
- Each feature's `*.dialects.test.ts` runs its repository on every database.

## What behaves differently on MySQL

Handled here:

- **Text is compared exactly.** The database must use `utf8mb4_0900_bin` (MariaDB:
  `utf8mb4_nopad_bin`), and opening one that doesn't says how to fix it. Others ignore case,
  accents or trailing spaces.
- **Times are UTC.** Connections set their time zone, and `datetime(3)` keeps milliseconds.
- **`text` is `longtext`,** because MySQL's `text` stops at 64 KB. Text in a key is
  `varchar(255)`, and longer values are refused there.
- **Upserts fire on any unique key,** so `upsert` refuses a table with a second one unless
  it's told the write can't clash with it.
- **JSON arrives as text** and is parsed by the column, because MariaDB's json is longtext.

- **Each statement sees what's committed.** Connections use read committed, as Postgres does.
- **A transaction MySQL undoes to break a deadlock is tried again,** up to four times. It can
  run more than once, so do anything that leaves the database, such as sending an email,
  after it.
- **Keys in JSON are written in one order,** the one jsonb uses, so MariaDB, whose json is
  text, can compare two values with `<>`.
- **`dashboard_layouts_one_owner` isn't there.** MySQL refuses a check on columns with `on
delete` rules. The repository writes either a person or a role, never both.
- **A value too long for a key** is refused with a plain 422 rather than an error.
- **Times in one transaction differ.** Postgres's `now()` is the same all through a
  transaction, and Node sets each row's time on MySQL. Don't rely on two rows matching.

To remember when moving a query:

- Ascending order puts nulls first on MySQL and last on Postgres. Use `orderNullsLast`
  on a column that can be null.
- A raw `sql` value in a `select` isn't read through a column. Booleans come back as 0 or 1
  and JSON as text. Use `.mapWith(column)` or `.mapWith(Boolean)`.
- MySQL can't read from a table in a subquery of a `delete` or `update` on that table, or
  use `limit` inside an `in (...)` subquery.
- `exists` over `json_table` finds nothing when it's the only condition on a join: count instead.

## Files

| File                        | What it does                                                                 |
| --------------------------- | ---------------------------------------------------------------------------- |
| `database-dialect.ts`       | Which dialect a database speaks, and what it can do                          |
| `mysql-tables.ts`           | Working out MySQL tables; `tableFor`                                         |
| `writes.ts`                 | `returning`, upserts and insert-if-new on each database                      |
| `reads.ts`                  | The newest row of each group                                                 |
| `expressions.ts`            | JSON, lists, case, counting, ordering and date maths                         |
| `database-errors.ts`        | How each database reports a broken unique key                                |
| `json-expressions.ts`       | Looking inside JSON, changing it and building it                             |
| `text-search.ts`            | Searching text and JSON for words                                            |
| `locks.ts`                  | A lock that ends with the transaction                                        |
| `raw-queries.ts`            | Rows from `execute`, and what differs in catalogue queries                   |
| `mysql-database.ts`         | Opening MySQL and MariaDB                                                    |
| `mysql-schema.cjs`          | Every table in MySQL's form, for drizzle-kit                                 |
| `postgres-only-rules.ts`    | What counts as Postgres-only; read by core's check and `lintel addons check` |
| `refuse-postgres-tables.ts` | In tests, fails a query on a table that skipped `tableFor`                   |
