---
title: Install on a VPS in one command
description: One command sets up Lintel on a new Ubuntu or Debian server, with HTTPS.
since: "0.1"
sidebar:
  label: VPS in one command
---

On a new server, one command installs everything Lintel needs, asks two questions, and
prints the address where you finish setting up. It takes about ten minutes, most of it
waiting.

## What you need

- A VPS running **Ubuntu 22.04 or 24.04, or Debian 12**, with at least **1 GB of memory**
  (the installer adds swap space on smaller servers, because building Lintel needs it).
  Hetzner, DigitalOcean, Linode and Vultr all offer one for about $5 a month.
- A **domain or subdomain**, such as `cms.example.com`, whose DNS **A record** points at
  the server's IP address. Set that up first: HTTPS can't be issued until it works.
- An email address, which Let's Encrypt uses to warn you if a certificate is about to
  expire.

## Run it

Sign in to the server (`ssh root@YOUR_SERVER_IP`) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/DanielHuntr/lintelcms/main/deploy/install.sh | sudo bash
```

It asks for your domain and email, shows what it will do, and asks you to confirm. Then:

1. Installs Docker, if it isn't there.
2. Downloads Lintel to `/opt/lintel`.
3. Writes `deploy/.env` with your domain and a new database password (written to the
   file only, never shown), and a Caddyfile with your email.
4. Starts Lintel, PostgreSQL and Caddy, which gets the HTTPS certificate.
5. Opens ports 80 and 443 if the `ufw` firewall is on.
6. Prints the address of the setup wizard and the **setup code** it asks for.

Open the address it prints, `https://cms.example.com/admin`, and follow the
[setup screens](/using/setup/).

To answer the questions in advance (for a script, say), pass them as options:

```bash
curl -fsSL https://raw.githubusercontent.com/DanielHuntr/lintelcms/main/deploy/install.sh |
  sudo bash -s -- --domain cms.example.com --email you@example.com --yes
```

## Without Docker

`--method node` installs Node.js 22 and Caddy instead, builds Lintel, and runs it as a
systemd service named `lintel` with the built-in database:

```bash
curl -fsSL https://raw.githubusercontent.com/DanielHuntr/lintelcms/main/deploy/install.sh |
  sudo bash -s -- --method node
```

| What                 | Where                              |
| -------------------- | ---------------------------------- |
| Lintel's code        | `/opt/lintel`                      |
| Settings             | `/etc/lintel/lintel.env`           |
| Database and uploads | `/var/lib/lintel` (back this up)   |
| The service          | `systemctl status lintel`          |
| The log              | `journalctl -u lintel -f`          |
| HTTPS                | Caddy, from `/etc/caddy/Caddyfile` |

Lintel listens on `127.0.0.1:4000` only; Caddy is the only way in. Its own timers run
scheduled publishing, so no cron job is needed.

## See what it would do first

`--dry-run` prints every step without changing anything:

```bash
curl -fsSL https://raw.githubusercontent.com/DanielHuntr/lintelcms/main/deploy/install.sh |
  bash -s -- --dry-run --domain cms.example.com --email you@example.com
```

## Running it again

It is safe to run the installer again, and that is also how you update Lintel: it
downloads the latest code and restarts. It keeps the database password and anything you
added below the line `# ---- Your own settings below this line are kept ----` in the
settings file, such as email settings. Your content is never touched.

## If something goes wrong

- **"Lintel didn't start within three minutes"**: the installer prints the command that
  shows Lintel's log. The last lines say why, usually a setting explained in one line.
- **The browser can't reach the site**: check the domain's DNS (it must show the
  server's IP address), and your provider's firewall, which must allow ports 80 and 443.
- **The certificate wasn't issued**: `docker compose -f /opt/lintel/deploy/docker-compose.yml logs caddy`
  (or `journalctl -u caddy` without Docker) says why; it is almost always the DNS.

Everything else (backups, handy commands) is in [A VPS with Docker](/hosting/vps-docker/).
