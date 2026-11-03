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

Not sure which kind of hosting you need, or whether yours can run Lintel? Start with
[Choose where to host Lintel](/hosting/choose/).

| If you have or want...                             | Follow                                        |
| -------------------------------------------------- | --------------------------------------------- |
| Shared hosting with cPanel's **Setup Node.js App** | [Install on cPanel hosting](/hosting/cpanel/) |
| A new VPS, set up for you with one command         | [A VPS in one command](/hosting/one-command/) |
| Your own server, about $5 a month, full control    | [A VPS with Docker](/hosting/vps-docker/)     |
| A server managed with Laravel Forge                | [Laravel Forge](/hosting/forge/)              |
| A Windows server, with IIS or Caddy                | [Windows Server](/hosting/windows/)           |
| No server to look after, deploys from GitHub       | [Railway](/hosting/railway/)                  |
| The same, with a free database to start            | [Render](/hosting/render/)                    |
| Servers close to visitors around the world         | [Fly.io](/hosting/fly/)                       |

Hosting that only runs PHP can't run Lintel, but it can serve a site Lintel publishes as
files; see [Choose where to host Lintel](/hosting/choose/).

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

`pnpm start` listens on port 4000 (or `PORT`), and that one port serves the website, the
admin and the API: `SITE_PORT` is only for `pnpm dev`. Put it behind a web server that
handles HTTPS, such as Caddy or nginx, with a single rule passing everything to it, and
keep it running with systemd or pm2 ([the installer](/hosting/one-command/) sets this up).
Lintel keeps its files in `.lintel/` unless you set `LINTEL_FOLDER`.

To check a server before installing, run `pnpm lintel doctor --hosting`: it checks the
Node.js version, memory, folders, image resizing and internet access, and says plainly
whether Lintel will run.

## Scheduled jobs

Lintel publishes scheduled entries, retries webhooks and runs automations on timers
inside its process. Hosts that pause idle apps (cPanel, Passenger) stop those timers, so a
cron job calls `POST /api/system/run-scheduled-jobs` instead, with the secret in an
`X-Lintel-Cron-Secret` header. `pnpm lintel cron --print-line` prints the whole line;
`pnpm lintel cron` runs the jobs once. Elsewhere the timers do the work and no cron job
is needed.

## What Lintel does for you

- **Checks its settings when it starts.** A mistake stops it with a message naming the
  setting and what is wrong, rather than failing later.
- **Updates the database by itself.** Every start brings the tables up to date.
- **Logs in JSON**, one line per event, each with a request id that also comes back in the
  `x-request-id` header. Passwords and cookies are never logged.
- **Stops gracefully.** On a deploy or restart, requests in progress finish first.
- **Compresses and caches** what it can, and never caches anything private.
