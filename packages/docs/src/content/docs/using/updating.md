---
title: Updating Lintel
description: Seeing when there's a new version, what it changes, and installing it safely.
since: "1.0.0-rc"
sidebar:
  label: Updating Lintel
---

New versions of Lintel bring fixes, including security fixes, and new things to use.
Lintel looks for them by itself once a day and tells you when there's one.

## Seeing what's new

When there's a new version, owners and admins see **Updates** with a number in the
sidebar, and the **Updates** card on the dashboard says how many there are, for example
"2 updates available · 1 security". A red shield means one of them fixes a security
problem: install that one soon.

Open **Settings → Updates** to see:

- which version you have now, and when Lintel last looked (**Check now** looks straight
  away);
- the new version, with what it changes in plain words. **What changes** opens the full
  release notes;
- labels such as **Security fix**, **Big changes** (something websites or plugins may rely
  on has changed: read the notes, or ask your developer, before updating) and **Beta** (a
  test version);
- newer versions of plugins your developer installed;
- how your site is updated (see below).

Owners of the site get an email when a security update comes out.

## Updating with the button

If your server runs Lintel with `lintel start` (the way the server guides set it up), you
update with one button. Only an owner can press it.

1. In **Settings → Updates**, press **Update to 1.2.0** (with the new version's number).
2. Read what will happen, tick **I understand**, and press **Update now**.

Then Lintel, by itself:

1. **downloads the new version** and checks it really is a Lintel release that nobody has
   changed on the way;
2. **backs up your whole site**. The backup is in Settings → Backups, marked "Before an
   update";
3. **restarts with the new version**. For about a minute, visitors see a "Back in a minute"
   page, and the admin shows that Lintel is being updated. While the site is paused, Lintel
   keeps an exact copy of your content as it is at that moment;
4. **checks the site works**. If the new version doesn't start properly, Lintel goes back to
   the version you had and puts that copy back, so nothing made before the restart is lost.
   Then it tells you what happened.

You can watch every step on the Updates screen. It carries on through the restart, so
there's no need to reload.

## Going back to an earlier version

Lintel keeps the versions it has run. Under **Earlier versions on this server**, press
**Roll back** next to one. You can also choose to put your content back as it was when you
updated away from it. Do that only if the newer version changed your content in a way you
don't want, because anything added since then is lost.

Some updates change how your content is stored. Going back past one of those always puts
your content back as it was, because the older version can't read the newer way. The
dialog says when that's so. Lintel keeps copies from the last three updates; if the copy
you'd need is gone, it won't roll back, and suggests staying on the newer version.

## When there's no button

How Lintel was installed decides how it is updated, and Settings → Updates explains yours:

- **Docker.** A container can't safely replace itself, so the screen shows the two
  commands to run on the server, with the version filled in. Your developer can switch on
  the optional **lintel-updater** service to get the button (see below).
- **Running from source** (a copy of Lintel's code, usually on a developer's computer). Stop
  Lintel, run `pnpm lintel update`, then start `pnpm dev` again. It makes a backup first and
  refuses to run if there are code changes that aren't committed, so no work is lost.
- **`pnpm start` without the supervisor.** Start Lintel with `pnpm lintel start` instead to
  get the button.
- **Shared hosting (cPanel) or Laravel Forge.** The screen lists the steps for your host.

If Lintel can't reach the internet, or the person who looks after your server switched
checks off, the screen says so.

## For whoever looks after the server

- **One-click updates** need Lintel started with `lintel start` (`node current/lintel.mjs
start` in a release folder). It keeps each version in `versions/`, and `current` points
  at the one running. The folder it runs in holds `.env`, `lintel.config.ts` and the data
  folder, shared by every version.
- **The built-in database** is copied into `versions/database-copies/` at each update, while
  the site is paused. Three copies are kept, each the size of the database.
- **On your own Postgres, MySQL or MariaDB server**, an update that changes the database
  isn't done with the button: Lintel can't keep an exact copy of a database server to go back
  to. The screen says so. Back up the database with your provider's tools, then update by hand (see
  [Keeping Lintel updated](/hosting/updating/)). Updates that don't change the database work
  with the button as usual.
- **If Lintel stops part-way through an update** (a crash or a power cut), it finishes or
  undoes the update the next time it starts, before the site comes back.
- **Docker's lintel-updater** is off unless you start compose with `--profile updater`
  and set `LINTEL_UPDATER_URL=http://lintel-updater:8080`, a long random
  `LINTEL_UPDATER_TOKEN` and `LINTEL_REPO_PATH` (the repository's full path) in
  `deploy/.env`. The trade-off: it needs the Docker socket, which is as powerful as root
  on that server. Leave it off if you'd rather run the two commands yourself.
- **Settings:** `UPDATE_CHECKS=off` stops Lintel looking for updates at all (for servers
  that mustn't reach the internet). `UPDATE_FEED_URL` points at an agency's own feed
  instead of Lintel's releases on GitHub.
- **Privacy:** a check is a single request for the list of releases. Nothing about your
  site, not even its version, is sent.
