# Backups

A backup is the whole site in one `.zip`: every table, every setting and every uploaded
file. Restoring one replaces the site with it. Settings → Backups, `lintel backup` and
`lintel restore` all use the code here.

## The archive

```text
manifest.json             format version, Lintel version, migrations, SHA-256 of every file
settings.json             every site setting, by key
database/<table>.json     the rows of each table
media/<storage key>       every uploaded file
```

Restoring checks everything before it replaces anything (`backup-verification.ts`): the
format version, that this Lintel knows every migration the backup's database had, and
every file's checksum. A damaged, edited or too-new backup is refused with a named error.
Rows are read and written through Postgres' own JSON functions
(`database-snapshot.repository.ts`), so there is no per-table code to keep in step.
`table-order.ts` says which tables are left out (sessions, the backups list itself, imports
in progress) and why.

## How it flows

- **Back up now**: `POST /backups` adds a "running" row and answers 202; the archive is
  written in the background (`src/scheduler/background-tasks.ts`) and the row marked
  complete or failed. A backup cut off by a server stop is marked failed on the next start.
- **Schedule**: `backup-schedule.service.ts` is asked every five minutes by
  `src/scheduler/scheduled-jobs.ts`. Only scheduled backups count towards "keep".
- **Restore**: `backup-restore.service.ts` first backs up the site as it is ("Before a
  restore"), then restores. One restore at a time; the request must send
  `{ confirm: "RESTORE" }`.

Archives live in `.lintel/backups`, or `LINTEL_BACKUPS_FOLDER` (`data-tools-folders.ts`).
The `backups` table has no reference to users, because restoring replaces the users.

| File                              | What it does                                          |
| --------------------------------- | ----------------------------------------------------- |
| `backups.routes.ts`               | HTTP: list, make, upload, download, schedule, restore |
| `backups.service.ts`              | The backups list: make, upload, delete                |
| `backup-archive.service.ts`       | Writing and restoring an archive from plain paths     |
| `backup-restore.service.ts`       | Restoring from the list, with a safety backup first   |
| `backup-schedule.service.ts`      | Daily and weekly backups, and removing old ones       |
| `backup-manifest.ts`              | The manifest's shape                                  |
| `backup-verification.ts`          | Checking an archive before restoring                  |
| `database-snapshot.repository.ts` | Whole-table reads and writes                          |
| `backups.repository.ts`           | The backups list's reads and writes                   |

Permissions: `backups:read` to see the list, `backups:manage` for everything else.
Zip reading and writing is in `src/archives`. People's guide: "Backups and moving your
site" in the docs.
