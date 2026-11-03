# 41. Going back a version puts the database back exactly, or doesn't happen

Date: 2026-11-04

Fixes LINTEL-DATA-011, LINTEL-DATA-013 and LINTEL-FUNC-027, and goes with LINTEL-FUNC-016.
It follows [0025](0025-updates-from-the-admin.md).

## The problem

A roll back (and an update that fails after migrating) used to put a backup's rows back
with the older version's `lintel restore`. A backup holds rows, not tables, so the rows went
into the newer version's tables. The older version then ran on tables it doesn't know. The
backup was also made before the download, so anything done during the download, such as an
order, was lost when it went back.

## Decision

**The built-in database is copied whole, at the switch.** Once the server has stopped and
the maintenance page is up, the supervisor copies the built-in database's folder (PGlite's
data folder) to `versions/database-copies/<id>/`. It holds the folder's lock while it does
this, so nothing can be writing to it. The copy is tables and rows together, as they were at
that moment. A failed update puts that copy back, and so does a roll back that asks for it.
The newest three copies are kept.

**Going back across database changes needs the copy.** Each release lists its migrations.
If the running version has a migration the older one doesn't know, a roll back must put
the copy back. The server refuses it otherwise ("Tick that box to go ahead"). If the copy
is gone, the roll back is refused and the message offers a safe path: stay on the newer
version, or go back by hand. The supervisor checks this again before stopping anything,
because it may be older or newer than the server that asks. Roll backs between versions
with the same tables can still keep the data as it is.

**Postgres servers: refuse rather than guess.** A database on a Postgres server can't be
copied this way. `pg_dump` and `pg_restore` aren't always installed, and restoring over a
newer schema leaves the newer tables behind. So an update that changes the database is
refused on Postgres before anything stops. The message is plain: make a backup with your
database provider, then update by hand. Updates that don't change the database still work
with one click. Supporting `pg_dump` can come later, once it can be tested against a real
server.

**The backup in Settings → Backups** ("Before an update") is still made, after the download
now, so it is as recent as it can be. It is for people to keep. The supervisor doesn't use
it for an update.

**A journal for a switch cut off part-way.** Before each step, the supervisor writes
`versions/switch-journal.json` (started, copied, migrating, switched, healthy). If it finds
the journal when it starts:

- an update that reached `healthy` is kept;
- an earlier update is reversed: the copy goes back if migrations had begun, and `current`
  points back;
- a roll back is done again from the start, because each of its steps can be repeated.

A server whose supervisor stops now stops too (`disconnect`), so the database is free for
this.

**Windows (LINTEL-FUNC-016).** A junction can't be renamed over another. On Windows the old
`current` is removed first and `current.next` renamed into place. If the switch is cut off
between the two, the next start renames `current.next` into place (`repairCurrentLink`).

## Trade-offs

- Each copy is the size of the database, and there are three of them.
- A copy holds the database, not uploaded files. Updates don't change files. A file deleted
  after an update and before a roll back stays deleted.
- Putting a copy back loses everything done since the update. The roll back dialog says so.
