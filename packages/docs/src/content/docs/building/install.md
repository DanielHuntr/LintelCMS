---
title: Installing Lintel
description: Running Lintel on your computer, its settings, and the commands you'll use.
since: "0.1"
sidebar:
  label: Install
---

## What you need

- **Node.js 22 or newer**, from [nodejs.org](https://nodejs.org).
- **pnpm 10**: `npm install -g pnpm@10.28.0`.

Nothing else. Lintel has a built-in database (PGlite, real Postgres in WebAssembly).

## Run it

```bash
git clone https://github.com/DanielHuntr/lintelcms.git
cd lintelcms
pnpm install
pnpm dev
```

`pnpm dev` starts the API on <http://localhost:4000> and the admin on
<http://localhost:5173>. Open the admin and follow the [setup screens](/using/setup/).
Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop; your content is kept in `.lintel/`.

The docs and the Next.js starter don't start with `pnpm dev`. Run them on their own:

```bash
pnpm --filter @lintel/docs dev       # these docs, on http://localhost:4321
pnpm --filter starter-nextjs dev     # the starter site, on http://localhost:3000
```

## Settings

Every setting has a default, so no `.env` is needed. To change one, copy `.env.example` to
`.env` at the repository root, or set it in the environment (which wins).

| Variable         | Default                       | What it does                                                                                                                      |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | none (built-in database)      | A Postgres, MySQL or MariaDB URL. Always wins over the setup screen's choice                                                      |
| `API_PORT`       | `4000`                        | The API's port                                                                                                                    |
| `ADMIN_ORIGIN`   | `http://localhost:5173`       | The admin's address, allowed to call the API from browsers                                                                        |
| `API_PUBLIC_URL` | `http://localhost:<API_PORT>` | The API's address as browsers reach it, used in file URLs                                                                         |
| `NODE_ENV`       | `production`                  | `pnpm dev` sets `development` so cookies work over HTTP                                                                           |
| `TRUST_PROXY`    | none                          | Behind nginx, Caddy or a load balancer: `true`, a number of hops, or the proxies' addresses, so limits see each visitor's address |

In a database URL, write `#`, `@` and `/` in the password as `%23`, `%40` and `%2F`.
Settings for running on a server (storage, email, HTTPS) are in the
[environment variables reference](/hosting/environment-variables/).
`pnpm db:up` starts a Postgres in Docker that matches `.env.example`.

## More commands

Stop Lintel first: the built-in database serves one program at a time.

```bash
pnpm create-admin --email you@example.com --name "Your Name"   # another Owner
pnpm reset-password --email you@example.com                    # a new password; signs out everywhere
pnpm db:migrate                                                # update the tables now
```

Both ask for the password without showing it. For scripts, set `LINTEL_ADMIN_PASSWORD`
or `LINTEL_NEW_PASSWORD`.

Backups, exports, imports and a check of your setup are in the `lintel` command
(`pnpm lintel help`); see the [command line reference](/building/command-line/).

## Starting over

Stop Lintel and delete the `.lintel` folder. That removes the built-in database, uploads
and the setup screen's choice, so the next `pnpm dev` starts setup again.
