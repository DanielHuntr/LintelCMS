---
title: Hosting on a VPS with Docker
description: Step by step, from a new server to Lintel on your own domain with HTTPS.
since: "0.1"
sidebar:
  label: VPS with Docker
---

A VPS (virtual private server) is a small computer you rent by the month, from Hetzner,
DigitalOcean, Linode, Vultr or similar. This guide sets up Lintel, its Postgres database
and Caddy, which gets a free HTTPS certificate for you. It takes about twenty minutes.
To have all of this done for you, use [the one-command installer](/hosting/one-command/)
instead; this guide explains each step.

## What you need

- A VPS running **Ubuntu 24.04** with at least **1 GB of memory** (2 GB is comfortable).
- A **domain or subdomain**, such as `cms.example.com`, where you can change the DNS.
- A terminal. On Windows, use PowerShell or Windows Terminal.

## 1. Point your domain at the server

In your domain's DNS settings, add an **A record** for the name you want (`cms`, or `@`
for the bare domain) with your server's IP address as the value. It can take a few minutes
to an hour to take effect. Check with `ping cms.example.com`: it should show the server's
address.

## 2. Sign in and install Docker

```bash
ssh root@YOUR_SERVER_IP
curl -fsSL https://get.docker.com | sh
```

That installs Docker and Docker Compose. Check with `docker compose version`.

## 3. Open the firewall

If your server uses `ufw` (Ubuntu's firewall), allow SSH and the web:

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Some providers also have a firewall in their control panel; open ports 80 and 443 there too.

## 4. Get Lintel

```bash
git clone https://github.com/DanielHuntr/lintelcms.git /opt/lintel
cd /opt/lintel
cp deploy/.env.example deploy/.env
```

## 5. Fill in the settings

Make a database password, then open the settings file:

```bash
openssl rand -hex 24      # copy what this prints
nano deploy/.env
```

Set these three, then save with <kbd>Ctrl</kbd>+<kbd>O</kbd>, <kbd>Enter</kbd> and
<kbd>Ctrl</kbd>+<kbd>X</kbd>:

```bash
LINTEL_DOMAIN=cms.example.com
PUBLIC_URL=https://cms.example.com
POSTGRES_PASSWORD=the-password-you-copied
```

Everything else can stay as it is for now. See the
[environment variables reference](/hosting/environment-variables/) for the rest.

## 6. Start it

```bash
docker compose -f deploy/docker-compose.yml --profile https up -d --build
```

The first build takes a few minutes. When it finishes, check that everything is running:

```bash
docker compose -f deploy/docker-compose.yml ps
```

All three services (`lintel`, `postgres`, `caddy`) should say `running`, and `lintel`
should become `healthy` within a minute.

## 7. Finish setting up in the browser

Open `https://cms.example.com/admin`. You'll be asked for a **setup code**, because you're
setting up from another computer. Find it in the log:

```bash
docker compose -f deploy/docker-compose.yml logs lintel | grep setupCode
```

Then follow the [setup screens](/using/setup/). The database is already chosen for you.

## Where your data lives

| Docker volume    | What is in it                                         |
| ---------------- | ----------------------------------------------------- |
| `postgres-data`  | All your content, users and settings                  |
| `lintel-uploads` | Uploaded images and documents                         |
| `lintel-data`    | Resized images (rebuilt if lost) and the email outbox |
| `caddy-data`     | Your HTTPS certificates                               |

Volumes survive restarts, rebuilds and updates. They are only removed by
`docker compose down -v`, so **never add `-v`** unless you mean to delete everything.

## Backups

Run these from `/opt/lintel`, for example every night from `cron`:

```bash
# The database
docker compose -f deploy/docker-compose.yml exec -T postgres pg_dump -U lintel lintel | gzip > lintel-$(date +%F).sql.gz
# Uploaded files
docker run --rm -v lintel_lintel-uploads:/uploads -v "$PWD":/backup busybox tar czf /backup/uploads-$(date +%F).tar.gz -C /uploads .
```

Copy the files somewhere other than this server. Many VPS providers also offer automatic
whole-server backups for a small fee, which is the simplest safety net of all.

## Handy commands

```bash
docker compose -f deploy/docker-compose.yml logs -f lintel     # follow the log
docker compose -f deploy/docker-compose.yml restart lintel     # restart after changing .env
docker compose -f deploy/docker-compose.yml exec lintel node dist/scripts/reset-password.js --email you@example.com
docker compose -f deploy/docker-compose.yml exec lintel node dist/scripts/send-test-email.js --to you@example.com
```

## If something goes wrong

- **The browser says the site can't be reached.** Check the DNS (step 1) and the firewall
  (step 3). `docker compose ... logs caddy` says whether the certificate was issued.
- **`lintel` keeps restarting.** `docker compose ... logs lintel` shows why, usually a
  setting it explains in one line.
- **"Set POSTGRES_PASSWORD in deploy/.env".** The settings file is missing or the line is
  empty; see step 5.
