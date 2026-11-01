---
title: Keeping Lintel updated
description: Getting new versions of Lintel safely, and going back if you need to.
since: "0.1"
sidebar:
  label: Updating
---

Updates bring fixes, including security fixes, so install them regularly: once a month
is a good habit. Lintel updates its own database tables when it starts, so updating is
the same few steps every time.

## Before you update

1. **Read the release notes** on GitHub for anything marked as needing action.
2. **Back up the database** (and uploads, if they are on the server). On a VPS, see
   [Backups](/hosting/vps-docker/#backups). Railway, Render and Fly offer database
   snapshots in their dashboards.

## A VPS with Docker

```bash
cd /opt/lintel
git pull
docker compose -f deploy/docker-compose.yml --profile https up -d --build
```

Docker builds the new version while the old one keeps running, then swaps them. Watch it
start with `docker compose -f deploy/docker-compose.yml logs -f lintel`, and check that
`https://your-site/ready` says `ready`.

To clean up old images now and then: `docker image prune`.

## Railway, Render and Fly.io

Bring the new version into your copy of the repository (on GitHub, **Sync fork**). Railway
and Render deploy it by themselves; on Fly.io, run `fly deploy`. Each waits for `/ready`
before sending visitors to the new version, so a broken start never replaces a working one.

## cPanel and other control panels

Upload and extract the new hosting package over the old one, click **Run NPM Install**,
then **Restart**. Your content is in `lintel/.lintel`, which the package never contains.
See [Updating Lintel on cPanel](/hosting/cpanel/#updating-lintel).

## The one-command installer

Run the installer again: it downloads the new version and restarts Lintel, keeping your
settings. See [Running it again](/hosting/one-command/#running-it-again).

## Without Docker

```bash
git pull
pnpm install
pnpm build
# then restart Lintel, for example: systemctl restart lintel
```

## Going back

If a new version misbehaves, go back to the previous one with git (for example
`git checkout v0.1.0`) and deploy again. If the new version had already updated the
database, restore the backup you made first: older versions don't know the newer tables.

## Staying informed

On GitHub, choose **Watch → Custom → Releases** on the Lintel repository to get an email
for each new version.
