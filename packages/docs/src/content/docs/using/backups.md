---
title: Backups and moving your site
description: Backing up the whole site, restoring it, and moving content to another Lintel.
since: "0.1"
sidebar:
  label: Backups and moving
---

Lintel has two ways to take your site somewhere safe or somewhere new:

- A **backup** is the whole site: every entry, person, setting and uploaded file. Restoring
  a backup puts the site back exactly as it was, replacing what is there now.
- An **export** is your content only: content types, entries, categories and tags, globals,
  menus and media. Importing it adds it to another site without replacing anything else
  there. Use it to move content between sites, or from a test site to the real one.

## Backing up

Go to **Settings → Backups** and press **Back up now**. The backup appears in the list
when it is ready, with when it was made and its size. Press **Download** to keep a copy on
your computer, somewhere other than the server.

A backup is one `.zip` file. Keep it somewhere safe and private: it holds everything,
including people's email addresses and their (scrambled) passwords.

### Backing up automatically

Under **Automatic backups**, choose **Daily** or **Weekly**, and under **Keep** how many
to keep. Lintel makes them on its own while it is running, and deletes the oldest
automatic backup when a new one would take it past that number. Backups you make by hand are
never removed on their own.

Backups are kept in the `.lintel/backups` folder next to Lintel (in the Docker image, and
wherever `LINTEL_FOLDER` is set, in its `backups` folder: `/data/backups`). To keep them
somewhere else, such as a separate disk, set `LINTEL_BACKUPS_FOLDER` to that folder.

## Restoring a backup

Restoring replaces everything on the site with what is in the backup. Anything added or
changed since the backup was made is lost, so Lintel first backs up the site as it is now
(**Before a restore** in the list). If you restore the wrong backup, restore that one.

1. In **Settings → Backups**, press **Restore…** beside the backup. To restore one made
   somewhere else, press **Restore from a file…** and choose its `.zip`.
2. Lintel checks the backup is complete and undamaged, and shows what changes: how many
   pages and posts, media files, people and so on there are now, and after restoring.
3. Tick **I understand that this replaces everything on the site**, type `RESTORE`, and
   press **Restore this backup**.

Everyone is signed out afterwards. Sign in with an account that is in the backup.

Lintel won't restore a backup that has been damaged or changed, or one made by a newer
version of Lintel than this one. It says which, and nothing is replaced.

## Moving content to another site

1. On the site the content is on, go to **Build → Import** and, under **Export this
   site's content**, press **Download export**. Leave **Include the media files** ticked
   unless you only want the text.
2. On the other site, go to **Build → Import** and choose the file under **Import a
   Lintel export**.
3. Lintel shows what the import will do: how many things are new, updated and kept as
   is. Choose what happens **When something is already here**:
   - **Keep what's here** leaves existing things alone and only adds what is new.
   - **Replace with the file's version** updates existing things to match the file.
4. Press **Import**. Everything goes in together, or (if something goes wrong) nothing does.

Importing the same file again changes nothing new, so it is safe to repeat. Entries are
matched by their address, content types and menus by their handle, and files by their
contents, so nothing is doubled up.

An export leaves out people, sign-ins, API tokens, webhooks and site settings. To move
those as well, use a backup.

## From the command line

Developers can do all of this in a terminal, which is handy for scheduled jobs and
deploys. See the [command line reference](/building/command-line/):

```bash
pnpm lintel backup
pnpm lintel restore .lintel/backups/lintel-backup-2026-11-01-0900-abc123.zip --dry-run
pnpm lintel export --output site.zip
pnpm lintel import site.zip --dry-run
```
