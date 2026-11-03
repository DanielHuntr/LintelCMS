---
title: Check this server
description: One command, or one screen, that says in plain English what a server is missing.
since: "0.6"
sidebar:
  label: Check this server
---

Lintel can test the server it runs on and tell you what's missing, with the words to send your
hosting company when it's something only they can change.

## In the admin

Open **Settings → This server**. Press **Check again** after anything changes. If something
needs your host, the page gathers it into one message to copy.

## In a terminal

If Lintel won't start, the admin can't help, so use the command:

```bash
pnpm lintel check                                         # from Lintel's folder
node lintel.js check                                      # in the shared-hosting package
docker compose exec lintel node dist/cli/lintel.js check  # with Docker
```

It also checks Lintel's settings and that the admin is built, and exits with 1 if something
stops Lintel working, so you can use it in a deploy script.

## What it looks at

| Check           | What it wants                                                                   |
| --------------- | ------------------------------------------------------------------------------- |
| Node.js version | 22 or newer                                                                     |
| Database        | Postgres answers at `DATABASE_URL` (14 or newer), or the built-in database runs |
| Memory          | 512 MB at the very least; 1 GB for the built-in database                        |
| Saving files    | Lintel can write to its data folder                                             |
| Image resizing  | The sharp program loads. Without it, pictures are shown at full size            |
| Internet access | The server can reach other websites over HTTPS, for email, payments and updates |

Not installed yet? `lintel-check.js` and `lintel-check.php` test hosting before you install
anything: see [Choose where to host](/hosting/choose/#not-sure-what-your-hosting-can-do).
