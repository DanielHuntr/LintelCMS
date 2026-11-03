# Fix log: one-click updates (`fix/update-blockers`)

Fixing pass, 4 Nov 2026, on `fix/update-blockers` from `release/1.0.0-rc` at `b495c58`. The
defects are described in `BUG-REPORT.md` (batch 3). There, only their status cells changed
from Open to Fixed. The design is in `docs/decisions/0041-going-back-a-version.md`.

**Environment:** Windows 11, Node 22, the built-in database. Each fix was reproduced first,
or shown by a test that fails on the old code.

## Summary

| Defect          | Commit    | Change in one line                                                                      |
| --------------- | --------- | --------------------------------------------------------------------------------------- |
| LINTEL-FUNC-016 | `3c7cd60` | On Windows the old `current` junction is removed before the new one is renamed in       |
| LINTEL-DATA-011 | `5400a20` | A failed update or a roll back puts back an exact copy of the database: tables and rows |
| LINTEL-DATA-013 | `5400a20` | The copy is taken once the site is paused, after the download, not before it            |
| LINTEL-FUNC-027 | `5400a20` | A switch journal lets a restarted supervisor finish or undo a half-done switch          |

The admin's roll back dialog, the guides, the Windows test fixes and this log are in the commit after `5400a20`.

## LINTEL-FUNC-016: every update after the first failed on Windows

**Reproduced:** the supervisor tests on Windows failed with `EPERM: operation not permitted,
rename '…\current.next' -> '…\current'` on the first switch after `current` existed. A
plain Node script showed the same: renaming a junction over another gives EPERM, while
removing a junction with `unlink` leaves its folder alone.

**Fix (`install-home.ts`):**

- On Windows, `pointCurrentAt` makes `current.next`, removes the old `current` and renames
  `current.next` into place.
- If Lintel stops between those two steps, `current.next` is still there.
  `repairCurrentLink` renames it into place the next time `current` is read.
- Linux and macOS keep the one-step rename of a relative symlink.

**Tests:** `install-home.test.ts`:

- "switches again and again (win32 way)": four switches in a row. It runs everywhere.
- The Linux way is skipped on Windows, because it is exactly what Windows refuses.
- "finishes a switch cut off between removing the old link and placing the new one".
- `supervisor.test.ts`: "switches more than once".

## LINTEL-DATA-011: a roll back put rows back into the newer tables

**Reproduced (by reading and test):** a roll back with "put the backup back" ran the older
version's `lintel restore`. It loads a backup's rows into whatever tables exist, which were
the newer version's. `insertAllRows` drops columns the rows lack, and new tables stay.

**Fix:**

- **The copy (`supervisor/database-copies.ts`).** The supervisor copies the built-in
  database's folder while the server is stopped, holding the folder's lock. Restoring is
  repeatable: copy to `data.restoring`, move `data` aside, rename into place.
- **Telling versions apart (`install-home.ts`).** Each release's migrations are read from
  its journal (`releaseMigrations`, `databaseDiffers`). If the running version has a
  migration the target doesn't, the copy must be put back.
- **Refusals.** The server refuses otherwise with `ROLLBACK_NEEDS_DATABASE_COPY`, in plain
  words: "Tick that box to go ahead", or, with no copy, "Stay on 1.1.0, or ask whoever
  looks after your server…". The supervisor checks again before stopping anything.
- **Postgres.** An update that changes the database is refused before anything stops,
  because that database can't be copied here (decision 0041).
- **Admin.** The roll back dialog no longer offers a checkbox that could be left off. When
  the newer version changed the database it says the content goes back too, or explains,
  and disables Roll back, when the copy is gone.

**Tests:**

- `database-copies.test.ts`, "puts the tables back as well as the rows". It uses a real
  built-in database: it adds a column and a table after the copy, restores, and checks
  both are gone and only the old row is left.
- Also there: "won't copy or replace the database while a server has it open", "can put a
  copy back again after being cut off part-way", "keeps the newest 3 copies".
- `supervisor.test.ts`: "rolls back on request, putting the database back exactly as it
  was before the update", "refuses to roll back across database changes without putting
  the copy back", "rolls back between versions with the same tables without touching the
  data", "on Postgres, refuses an update that changes the database before stopping
  anything".
- `updates.test.ts`: "only rolls back across database changes with the database put back
  as it was".
- `Updates.test.tsx`: "rolling back after the database changed" (2 tests).

## LINTEL-DATA-013: a failed update lost orders made during the download

**Reproduced (by reading):** `runUpdate` made the backup before downloading. A failed update
restored it, so anything done during the download was lost.

**Fix:**

- What a failed update puts back is now the database copy. The supervisor takes it at the
  switch, after the download and the checks, with the site already paused, so nothing can
  happen between the copy and the switch.
- The "Before an update" backup is still made for people to keep, now after the download.
  The supervisor no longer restores it for an update.

**Test:** `supervisor.test.ts`, "goes back by itself, with the database as it was at the
switch, when the new version doesn't start". An order written after the server asked to
update survives the failed update. "goes back without touching current when the
migrations fail, undoing what they did" checks the same for half-run migrations.

## LINTEL-FUNC-027: the supervisor didn't recover from stopping mid-switch

**Reproduced (by reading):** nothing recorded a switch in progress. A supervisor that
started again just started whatever `current` pointed at, on whatever the database held.

**Fix (`supervisor/switch-journal.ts`, `supervisor.ts`):**

- Before each step the supervisor writes `versions/switch-journal.json`: started, copied,
  migrating, switched, healthy.
- On start, if the journal is there:
  - an update that reached `healthy` is kept and recorded as done;
  - an earlier update is reversed: the copy goes back if migrations had begun, and
    `current` points back. It is recorded as failed, with "Lintel stopped part-way through
    updating to …";
  - a roll back is done again from the start.
- The server now stops when its supervisor goes away (`disconnect` in `main.ts`), so the
  database is free for the restarted supervisor.

**Tests:** `supervisor.test.ts`, "after stopping part-way through a switch" (4 tests: after
`switched`, after `copied`, after `healthy`, and a roll back).

## Windows test failures in this area

- **Fixed:**
  - `tar` from Git for Windows read `C:\…` as a remote host ("Error is not recoverable").
    Releases now unpack with Windows' own `System32\tar.exe` (`tarProgram`), and so does
    the test helper. This also matters on real Windows servers where Git's tar comes first
    on the PATH.
  - `install-type.test.ts` built a POSIX path where the code joins one.
  - With FUNC-016, all of `updates.test.ts` (10), `release-signature.test.ts` (4),
    `supervisor.test.ts` and `install-type.test.ts` now pass on Windows.
- **The other start-up tests:**
  - `main.test.ts` and `dev-runtime.test.ts` ran `node_modules/.bin/tsx`, a shell script
    Windows can't start. They now run tsx's own script with Node.
  - `main.test.ts` also expected exit code 0 after SIGTERM, but Windows has no SIGTERM to
    catch. That check now runs everywhere except Windows. Its clean-up waited for a
    process that had already ended by a signal.
  - `model-sync.test.ts` compared paths with forward slashes.
- **Still failing on Windows:** none in core. In the CLI, `command-line.test.ts` ("reads
  paths from where the person ran the command") and `model.test.ts` ("reads the same
  settings and defaults as the server") still fail on Windows paths. They aren't in this
  area and weren't changed.

**Test runs (Windows, after the last commit):**

- core: 186 files, 1,218 passed, 6 skipped, none failed. That is the full run (1,215
  passed, 3 failed), and then the three fixed start-up files run again;
- admin: 748 passed;
- docs: 13 passed;
- cli: 34 passed, 2 failed (the Windows path tests above);
- format, lint and typecheck clean for the changed packages; core, admin and docs build.

## Not done

- No real update and roll back of a release build was run on Linux or Windows. Only the
  tests above were run.
- The roll back dialog's new text wasn't checked in a browser. The change is two sentences
  and a disabled button in an existing dialog; the component tests cover them.
- Postgres updates that change the database still need doing by hand. `pg_dump` support is
  left for later (decision 0041).
