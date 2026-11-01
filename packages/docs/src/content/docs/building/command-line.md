---
title: Command line reference
description: Every lintel command, its options, and what it prints.
since: "0.1"
sidebar:
  label: Command line
---

`lintel` is Lintel's command line tool. Run it from the folder Lintel is in:

```bash
pnpm lintel <command> [options]
pnpm lintel help              # lists the commands
pnpm lintel <command> --help  # one command's options
pnpm lintel --version         # which version of Lintel this is
```

Commands use the same database as the server: `DATABASE_URL` if it is set, then the
setup screen's choice, then the built-in database. The built-in database can only be open
in one program at a time, so stop `pnpm dev` before running a command that opens it.

Paths you type are relative to the folder you ran the command from. Every command exits
with 0 when all went well and 1 when it didn't, so they can be used in scripts.

## start

```bash
pnpm lintel start [--home <folder>]
node current/lintel.mjs start          # in a release folder
```

Runs Lintel on a server under a small supervisor, which starts it again if it stops and
installs updates from Settings → Updates: it keeps each version in `versions/`, points
`current` at the one running, and goes back by itself if a new version doesn't start. The
home folder (`--home`, `LINTEL_HOME`, or the folder it's run from) holds `.env`,
`lintel.config.ts` and `.lintel` (unless `LINTEL_FOLDER` says otherwise), shared by every
version. Stop it with Ctrl+C or SIGTERM; it stops Lintel first. See
[Updating Lintel](/using/updating/).

## update

```bash
pnpm lintel update [--to <version>] [--branch <name>]
```

Updates a copy of Lintel run from a git clone. It refuses to start while tracked files
have changes, so your work is never touched. Then it fetches, picks the newest release tag
(or `--to 1.2.0`; without release tags, the latest commit of the branch checked out or
`--branch`), backs up the site, checks the new version out, runs `pnpm install` and the
migrations, and tells you to start `pnpm dev` again. Stop Lintel first: the built-in
database can only be open in one program.

## doctor

```bash
pnpm lintel doctor
```

Checks this machine can run Lintel, and says how to fix what isn't right: the Node.js and
pnpm versions, the `.env` settings, whether the database can be reached and its tables
are up to date, whether the media and backups folders can be written to, and whether the
API and admin ports are free. A `✗` is a problem to fix; a `!` is worth a look but doesn't
stop Lintel.

## backup

```bash
pnpm lintel backup [--output <file.zip>]
```

Backs up the database, settings and media into one `.zip`. Without `--output` it goes in
the backups folder (`.lintel/backups`, or `LINTEL_BACKUPS_FOLDER`), where **Settings →
Backups** lists it too.

The archive holds `manifest.json` (the Lintel version, the database's migrations and the
SHA-256 of every other file), `settings.json`, one `database/<table>.json` per table and
the uploaded files under `media/`. Sign-ins are left out, so restoring signs everyone out.

## restore

```bash
pnpm lintel restore <backup.zip> [--dry-run] [--yes]
```

Replaces the whole site with a backup. It first checks every file in the archive against
the manifest and that this Lintel knows every migration the backup's database had, then
shows what the site has now beside what it will have.

- `--dry-run` stops after the checks. Nothing is changed.
- Without `--yes` it asks before replacing anything.

Before replacing anything, it backs up the site as it is now into the backups folder
("Before a restore"), so a restore can be undone.

## export

```bash
pnpm lintel export [--output <file>] [--revisions] [--no-files]
```

Exports content types, entries, taxonomies and terms, globals, menus and media into a
portable file that any Lintel can import. People, settings, API tokens and webhooks aren't
included; use `backup` for those.

- The export is `lintel-export.json`, in a `.zip` with the media files under `media/`.
- `--no-files` writes the `.json` on its own, with the media's details but not the files.
- `--revisions` includes every saved version of each entry, not only the current one.
- Without `--output` it is saved as `lintel-export-<date>.zip` in the current folder.

## import

```bash
pnpm lintel import <export.zip|export.json> [--strategy skip|overwrite] [--dry-run]
```

Imports a Lintel export into this site, adding to what is here. It prints a table of what
will be added, updated and kept as it is, then imports everything in one transaction:
all of it goes in, or none of it does.

Things are matched by id first, then content types, taxonomies, globals and menus by
handle, terms by slug, media by its contents and entries by collection, language and
slug. Running the same import twice changes nothing the second time.

- `--strategy skip` (the default) keeps what this site already has.
- `--strategy overwrite` updates it to match the file.
- `--dry-run` prints the table and changes nothing.

## migrate

```bash
pnpm lintel migrate [--status]
```

Brings the database's tables up to date. The server does this every time it starts, so
this is for deploys that like it as a separate step. `--status` only says how many
migrations are still to apply, and exits with 1 if there are any.

## model

```bash
pnpm lintel model pull  [--format typescript|yaml]
pnpm lintel model push  [--yes] [--allow-data-loss]
pnpm lintel model diff  [--exit-code]
pnpm lintel model types [--out <file>] [--from files|database]
pnpm lintel model check [--types <file>]
```

Keeps the content model (collections, content types, taxonomies and globals) in files
next to your code, in `CONTENT_MODEL_FOLDER` (`content-model` by default).

- `pull` writes the database's content model to the files.
- `diff` shows what `push` would change. With `--exit-code` it exits with 1 when there
  are changes.
- `push` shows the changes, asks, then applies the files to the database. It refuses
  changes that would delete content unless you add `--allow-data-loss`.
- `types` writes TypeScript types for your content to `CONTENT_MODEL_TYPES_FILE`
  (`generated/lintel-content.ts` by default), from the files or, with `--from database`,
  from the database.
- `check` is for CI: the files are valid and each `--types` file is up to date. It
  doesn't need a database.

These commands need a version of Lintel that includes content model files; older ones
say so.

## create-admin

```bash
pnpm lintel create-admin --email <email> --name "<name>"
```

Adds an Owner. Most people never need this: the setup screen creates the first one.
The password is asked for twice without showing it, or read from `LINTEL_ADMIN_PASSWORD`
for automated installs. It is never a flag, because flags end up in shell history.
`pnpm create-admin` is a shortcut for the same command.
