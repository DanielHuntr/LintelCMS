# Fix log: independent review of the night's work (`fix/night-review`)

A second reading of `dde71e4d..9943c3c1`, 4 Nov 2026, on `fix/night-review` from `9943c3c1`. Each fix was made test-first: the regression test was run against the old code to see it fail, then against the fix. The defects are listed in `BUG-REPORT.md`.

**Environment:** Windows 11, Node 24, the built-in database in tests. PHP 8.1 was installed for this run, so the companion's tests ran under real PHP rather than being skipped. Nothing here changes a screen, so there are no screenshots.

**Test runs (after the last fix):**

- format check on the changed folders, ESLint on the changed files, `pnpm typecheck` (29 tasks) and `pnpm --filter @lintel/core build`: all clean;
- core, with PHP on the path: 245 files, 1,658 passed, 11 skipped, none failed;
- plugin-example-bookings 7, addon-newsletter 22, addon-instagram 13: all passed;
- admin, builder and the other packages weren't run: nothing in them changed.

**Migrations 0032 to 0036:** run on a new database and on one stopped at 0031 with rows in `blocks`, `shop_orders`, `shop_settings`, `form_submissions` and `webhooks`, on the built-in database only. Both ended with the same tables and columns, existing rows took the defaults, a second run changed nothing, the journal's dates are in order, and `db:generate` reports no changes.

## Summary

| ID              | Severity | Commit                 | Change in one line                                                                               |
| --------------- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| LINTEL-CODE-017 | P1       | `d2b39feb`             | Delete data and export can't reach Lintel's own tables, whatever an add-on declares or is called |
| LINTEL-CODE-018 | P1       | `e6448b3a`, `681f9d41` | The PHP companion records Stripe's delayed payments, and late payments after their hold ended    |
| LINTEL-CODE-019 | P2       | `8f5d3664`             | A publish can't reach past the folder beside the website, and the host's file list is checked    |
| LINTEL-CODE-020 | P2       | `e273f3ef`             | Finding someone by email also looks through every answer, not only the form's first email        |
| LINTEL-CODE-021 | P2       | `e273f3ef`             | The orders retention rule unlinks the customer, and deletes one left with no orders              |
| LINTEL-CODE-022 | P2       | `b2f06150`             | A form entry collected from a published site can't be lost, and keeps its consent wording        |
| LINTEL-CODE-023 | P2       | `7382dbc3`             | An app whose installer is deactivated stops being sent events                                    |
| LINTEL-CODE-024 | P3       | `e273f3ef`             | Exported order totals are right for currencies without minor units                               |
| LINTEL-CODE-025 | P3       | `06fe8378`             | Deleting test orders keeps a customer who was there before the test                              |
| LINTEL-CODE-026 | P3       | `d6bde279`             | One PayPal or Mollie payment that can't be read no longer holds up the others                    |
| LINTEL-CODE-027 | P3       | `9483387d`             | Add-on CSV exports can't run as spreadsheet formulas                                             |
| LINTEL-CODE-028 | P3       | `7103b839`             | `lintel-check.php` asks for PHP 7.4, as the companion does, not 8.1                              |
| LINTEL-CODE-029 | P3       | `01206a4c`             | Two comments no longer speak of a hosted version of Lintel                                       |

LINTEL-CODE-020, 021 and 024 share one commit.

## The fixes

- **LINTEL-CODE-017.** An add-on's tables were whatever it declared, plus anything named after its id, and `POST /addons/:id/delete-data` runs `truncate … cascade`. An add-on with the id `shop` therefore owned `shop_orders` and `shop_customers`, and one declaring `users` could export password hashes or empty the table. The regression test (`addon-core-tables.test.ts`) failed on all three routes. Lintel's own tables now never count, in details, export, delete or backups.
- **LINTEL-CODE-018.** The companion only handled `checkout.session.completed`, which is unpaid for a bank debit, and it dropped holds a day after they ended, so a later payment found nothing and the money had no order. Each half was shown separately under PHP: with only the first fixed, the test still failed. Holds are now kept for 30 days, and they stop counting against stock after 35 minutes as before. Sites that publish this way need the second event added to Stripe's webhook; the hosting guide says so.
- **LINTEL-CODE-019.** `remotePath` never refused anything: a relative root's parent is `.`, which every `../` path starts with, and an absolute root's paths never start with `../`. The folder remote compared prefixes, so `/sites-backup` passed for a site in `/sites/mine`. The list of published files sits on the host and its entries get deleted, so its paths are now checked too.
- **LINTEL-CODE-022.** The receipt and the entry were written separately. If the entry failed, the next collection saw the receipt, called it a duplicate and told the companion to forget it. They now share a transaction.

## Decisions for Daniel

1. **Finding by name treats two people as one.** Searching "Sam Lee" finds both customers called that, shows two identical lines ("Customer: Sam Lee"), and export or erase takes both. Proved with a throwaway test against `/privacy/people/find` and `/erase`. The API also takes an email and a name together and matches either, so a name widens an email search; the admin never sends both. Options: show the email on each line, let the owner tick which to include, or make erasing by name need a second check.
2. **"Folder on this server" and SSRF for publishing.** Anyone with `settings:update` can publish to any folder the server can write to, and point FTP, SFTP or an S3 endpoint at private addresses such as 169.254.169.254. Webhooks refuse those; publishing doesn't, and a NAS on the office network is a fair use. Options: a list of allowed folders in the environment, and refusing private addresses unless the server allows them.
3. **The first retention run after an upgrade.** It deletes baskets over 30 days and activity logs over 90 days, security log included, without the owner having chosen. Decision 0065 records this on purpose. It is listed here because it can't be undone: a warning, or a first run delayed by some days, would be cheap.
4. **Private folder inside the website on Nginx.** `lintel-private` protects itself with `.htaccess` and `web.config`. Nginx reads neither, so `data/holds.json` (names, emails, addresses) could be downloaded if the folder ends up inside the web root there. Not tested on Nginx. The companion could refuse to run, or the publish could warn, when the folder can be fetched.
5. **The companion and `isTest`.** Orders collected from it are never marked as tests, even when paid with Stripe or Mollie test keys. No real sale is hidden, but test sales count in the figures.
6. **`read_forms` beyond the installer.** The API cuts an app's scopes down to its installer's permissions; webhooks don't. An installer with `settings:update` but not `forms:read` could still give an app form entries through `form.submitted`. Only a custom role can be like that.
7. **READMEs.** New folders without one: `packages/cli/src/apps`, `packages/cli/src/commands`, `packages/builder/src/editor`, `packages/builder/src/i18n`, `packages/builder-model/src/components`, `packages/core/src/publishing/remotes`, `packages/motion/src/effects/*`. Whether each counts as a feature folder is a judgement call, so none were added.
