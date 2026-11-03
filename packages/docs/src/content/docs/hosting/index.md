---
title: Running Lintel on a server
description: How Lintel runs in production, and which hosting guide to follow.
since: "0.1"
sidebar:
  label: Start here
---

Lintel runs on a server that runs Node.js, with Postgres or its built-in database. See
[What Lintel needs to run](/hosting/requirements/) for the details and some hosting
companies that suit it.

On your computer, `pnpm dev` runs the API and the admin separately so they reload as you
edit. On a server, Lintel runs as **one program** that serves everything:

| Address   | What it is                                                       |
| --------- | ---------------------------------------------------------------- |
| `/`       | Your website (a "coming soon" page until your site is connected) |
| `/admin`  | The admin, where editors work                                    |
| `/api`    | The API your website and apps read content from                  |
| `/health` | Answers while Lintel is running, for uptime checks               |
| `/ready`  | Answers when the database and file storage work, for deploys     |

So a site at `https://example.com` has its admin at `https://example.com/admin` and its
API at `https://example.com/api`. A website built separately, such as the
[Next.js starter](/building/nextjs-starter/), sets `LINTEL_API_URL=https://example.com/api`.

## Pick a guide

| If you want...                                  | Follow                                    |
| ----------------------------------------------- | ----------------------------------------- |
| Your own server, about $5 a month, full control | [A VPS with Docker](/hosting/vps-docker/) |
| No server to look after, deploys from GitHub    | [Railway](/hosting/railway/)              |
| The same, with a free database to start         | [Render](/hosting/render/)                |
| Servers close to visitors around the world      | [Fly.io](/hosting/fly/)                   |

Whichever you choose, go through the [production checklist](/hosting/checklist/) before
you invite editors, and read [Keeping Lintel updated](/hosting/updating/). Every setting is
in the [environment variables reference](/hosting/environment-variables/).

## Without Docker

Any machine with Node.js 22 can run Lintel directly:

```bash
pnpm install
pnpm build
PUBLIC_URL=https://example.com DATABASE_URL=postgres://... pnpm start
```

`pnpm start` listens on port 4000 (or `PORT`). Put it behind a web server that handles
HTTPS, such as Caddy or nginx, and keep it running with systemd or pm2. Lintel keeps its
files in `.lintel/` unless you set `LINTEL_FOLDER`.

## What Lintel does for you

- **Checks its settings when it starts.** A mistake stops it with a message naming the
  setting and what is wrong, rather than failing later.
- **Updates the database by itself.** Every start brings the tables up to date.
- **Logs in JSON**, one line per event, each with a request id that also comes back in the
  `x-request-id` header. Passwords and cookies are never logged.
- **Stops gracefully.** On a deploy or restart, requests in progress finish first.
- **Compresses and caches** what it can, and never caches anything private.
