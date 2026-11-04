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
