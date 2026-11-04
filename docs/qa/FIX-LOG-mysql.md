# Fix log: MySQL and MariaDB (feature/mysql-foundation, 4 November 2026)

What running the whole core suite on MySQL 8.4 and MariaDB 11.4 found, and what was done. None
of these reached anyone: nobody could run Lintel on these databases before this work. The plan
and decisions are in `docs/decisions/0049-any-database.md`.

| What happened on MySQL                                                 | Cause                                                                      | Fix                                                           | Regression test                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| Clearing test orders left the customer behind                          | Postgres gives a whole transaction one `now()`; Node stamps each MySQL row | The order's time is taken before its customer is made         | `test-checkout.test.ts`                                    |
| Finding a person by name missed their form entries                     | `exists` over `json_table` became a semi-join and found nothing            | It counts instead                                             | `json-expressions.dialects.test.ts`                        |
| The recycle bin, search and retention answered 500 on MariaDB or MySQL | JSON functions give `utf8mb4_bin`, which clashed with other collations     | Connections use `utf8mb4_bin`; the bin's lookup names its own | `recycle-bin.test.ts`, `json-expressions.dialects.test.ts` |
| An add-on's CSV had its columns in the wrong order                     | `information_schema` has no order of its own                               | Ordered by position, on every database                        | `addon-details.test.ts`                                    |
| A null publish date sorted last in newest-first delivery               | Descending puts nulls first on Postgres and last on MySQL                  | `orderNewestFirst`                                            | `json-expressions.dialects.test.ts`                        |
| A value too long for a key would have been a 500                       | Text in a key is `varchar(255)` on MySQL                                   | A plain 422                                                   | `json-expressions.dialects.test.ts`                        |
| Test emails were missing, or the previous one was found                | Emails go out after the response, and a pool shows that up                 | The test server waits for them. Nothing changes for visitors  | `invitations.test.ts`, `password-reset.test.ts`            |

Deadlocks had no failing test to start from. `json-expressions.dialects.test.ts` now makes a
real one and checks the transaction is tried again.

The setup screen was checked in Chromium against a real MySQL at 1280 and 390 wide, in light and
dark: the choice, the usual port and user, the plain message for a wrong password,
and a passing connection test. No sideways scrolling, no page errors. Finishing setup in the
browser wasn't run; `mysql-start-up.dialects.test.ts` does that through the API on both engines.

## Closing the known limits (feature/mysql-addons, 4 November 2026)

What closing the limits in `docs/decisions/0049-any-database.md` found. The first group reached
nobody on MySQL, as these databases are new. LINTEL-UX-444 and LINTEL-UX-445 were on Postgres
and the built-in database too.

| ID            | What happened                                                                    | Where              | Cause                                                                                | Fix                                                                  | Regression test                                                      |
| ------------- | -------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| LINTEL-UX-440 | Newsletter, Instagram and Bookings couldn't be switched on                       | MySQL, MariaDB     | Postgres-only queries, and no MySQL migrations                                       | Moved, with `tableFor`, the portable writes and `migrations-mysql`   | `pnpm test:addons`, `addons-packed.test.ts`                          |
| LINTEL-UX-441 | Instagram's pictures had no MySQL column type                                    | MySQL, MariaDB     | `bytea` is a custom column                                                           | It becomes `longblob`, read back as a `Uint8Array`                   | `mysql-tables.test.ts`, `addons-packed.test.ts`                      |
| LINTEL-UX-442 | An add-on's bytes, times and JSON came out of a backup in the wrong form         | MySQL, MariaDB     | A table known only by name was read raw                                              | Columns are looked up, and written as Postgres writes them           | `mysql-start-up.dialects.test.ts`, `mysql-snapshot.dialects.test.ts` |
| LINTEL-UX-443 | "port" found "support" in a page's body                                          | MySQL, MariaDB     | `like` and `json_search` can't see where a word starts                               | Each row found is checked in Node, split as Postgres splits it       | `word-starts.dialects.test.ts`                                       |
| LINTEL-UX-444 | Importing a global set's values failed                                           | Every database     | `upsertGlobalValues` named a key dropped when sites arrived                          | It names the site too                                                | `content-transfer.dialects.test.ts`                                  |
| LINTEL-UX-445 | An order search for a number over 2,147,483,647 failed with a 500                | Postgres, built-in | The number was compared with an integer column                                       | Numbers that can't fit aren't compared                               | `orders.dialects.test.ts`                                            |
| LINTEL-UX-446 | A unique list field said a list in another order was already used                | MySQL, MariaDB     | Each value holding the other ignores order and repeats                               | Rows found are compared exactly in Node                              | `entries.dialects.test.ts`                                           |
| LINTEL-UX-447 | A restore marked the rows it filled in as edited, and raised their version       | MySQL, MariaDB     | `.set` ran each column's `$onUpdate`                                                 | Those columns are named, and keep their values                       | `database-snapshot.dialects.test.ts`                                 |
| LINTEL-UX-448 | Deleting an add-on's data failed on tables that point at each other              | MySQL, MariaDB     | Rows were deleted with foreign key checks on                                         | Checks are off meanwhile, and put back as they were                  | `database-snapshot.dialects.test.ts`                                 |
| LINTEL-UX-449 | A plugin kept out of routes still ran its timed jobs and event handlers          | MySQL, MariaDB     | A restored list of plugins was trusted                                               | `isPluginRunning` is asked everywhere a plugin acts                  | `mysql-start-up.dialects.test.ts`                                    |
| LINTEL-UX-450 | A renamed field could show "unpublished changes" that weren't there              | MariaDB            | `<>` compared text, and `json_set` puts a moved key last                             | `jsonDiffers` uses `json_equals` there                               | `content-tree.dialects.test.ts`                                      |
| LINTEL-UX-451 | After a deadlock, an order email went twice, and the first named an undone order | MySQL, MariaDB     | Follow-ups were collected outside the transaction that was tried again               | `transactionThenFollowUps` keeps only the attempt that committed     | `payment-follow-up.test.ts`, `transactions-run-twice.test.ts`        |
| LINTEL-UX-452 | After a deadlock, restoring from the bin listed entries twice                    | MySQL, MariaDB     | The same, with `liveEntryIds`                                                        | It starts empty each time                                            | `transactions-run-twice.test.ts`                                     |
| LINTEL-UX-453 | After a deadlock, an imported picture was downloaded and stored twice            | MySQL, MariaDB     | The download and the file were inside the item's transaction                         | Pictures aren't in a transaction. The same file gives the same asset | `wordpress-import.test.ts`                                           |
| LINTEL-UX-455 | A deadlock in a nested write answered 500, where it should have been tried again | MySQL, MariaDB     | It undoes the savepoint too, so Drizzle's rollback to it failed and hid the deadlock | A missing savepoint counts as an undone transaction                  | `json-expressions.dialects.test.ts`                                  |
| LINTEL-UX-454 | The database took a dashboard layout with two owners, or none                    | MySQL, MariaDB     | MySQL refuses a check on columns with `on delete` rules (error 3823)                 | The check is on a virtual generated column, in migration 0003        | `dashboard.dialects.test.ts`, `mysql-start-up.dialects.test.ts`      |

LINTEL-UX-444 to 448 came from the new dialect tests for the last 22 repositories, not from anyone
seeing them. LINTEL-UX-451 to 453 need a real deadlock at the wrong moment, and none was seen in a run: each
was found by tracing every transaction. `payment-follow-up.test.ts` plays the retry for the first.
`transactions-run-twice.test.ts` holds the second to its rule. The third has no test that makes a
deadlock: the import tests only show pictures still come in outside a transaction.

LINTEL-UX-455 showed once, as a 500 in the race between a payment's return and its webhook, on a run
on MariaDB 10.11. The race passed six times in a row alone, so that it was this deadlock is our
reading of the code, not something the failed run recorded. The new test makes the deadlock.

Left as found: on the built-in database a jsonb value that is text holding valid JSON, such as the
setting `"42"`, reads back as the number. It comes from how PGlite and Drizzle parse JSON, it is
not new, and Postgres and the built-in database were to stay as they are. Its test records it
with `it.fails`.
