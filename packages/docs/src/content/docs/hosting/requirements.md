---
title: What Lintel needs to run
description: The kind of hosting Lintel needs, its database, and some hosting companies that suit it.
since: "1.0.0-rc"
sidebar:
  label: What it needs
---

Lintel is software you run yourself. You choose where it runs, and you pay that company
directly. Lintel doesn't host websites.

## A server that runs Node.js

Lintel is a Node.js program, so it needs hosting that can run one: a server, a virtual
private server (VPS) or a platform that runs apps or Docker containers.

- **Node.js 22 or newer**, or Docker, which brings its own.
- **At least 1 GB of memory**; 2 GB is comfortable. [Page drafting](/using/page-drafting/)
  needs about 8 GB, but most sites don't use it.
- **A disk that survives restarts** for uploaded files, or a storage bucket that works like
  Amazon S3.
- **HTTPS** for your address. Most platforms give you this; on your own server, Caddy or
  nginx in front of Lintel does it.

Shared hosting that only runs PHP (the usual kind for older content systems) can't run
Lintel, and neither can hosting for static files only.

## A database

Lintel uses **the built-in database, Postgres, MySQL or MariaDB**.

- **The built-in database** needs nothing set up. It's meant for one person trying Lintel
  on one computer.
- **Postgres** is for a live site on a server. Any Postgres works: one your host
  provides, a managed service, or one on your own server. Set `DATABASE_URL` to its address.
- **MySQL 8.4 or newer, or MariaDB 11.4 or newer** suits hosts that come with one of these.
  Lintel's tests run on those two versions. Set `DATABASE_URL` to `mysql://...`, or choose it
  on the setup screen, which can create the database for you.

If you make the MySQL or MariaDB database yourself, it has to compare text exactly, or Lintel
won't start, and it says so. On MySQL:

```sql
CREATE DATABASE lintel CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
```

On MariaDB, use `utf8mb4_nopad_bin` in place of `utf8mb4_0900_bin`.

A few things differ on MySQL and MariaDB:

- Add-ons that keep their own tables only run there if they say they support it. Others stay
  switched off. See [Running on MySQL](/building/writing-a-plugin/#running-on-mysql-and-mariadb).
- Text used to find a row, such as a page's address, is kept to 255 characters.
- Search also finds a word inside a longer word in a page's body, so "port" finds "support".

Back up whichever you use, and try restoring a backup once. See
[Backups](/using/backups/) and the [production checklist](/hosting/checklist/).

## Email

To send invitations, password resets and form notifications, Lintel needs an email service
it can send through: any SMTP server, Resend or Postmark. See
[Environment variables](/hosting/environment-variables/#email).

## Hosting companies that suit Lintel

These companies run Node.js apps and Postgres well. They're listed as examples, not
endorsements; prices and plans change, so check them yourself.

| Kind of hosting                       | Companies                                     | Our guide                                                |
| ------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| A virtual private server, with Docker | Hetzner, DigitalOcean, Linode (Akamai), Vultr | [A VPS with Docker](/hosting/vps-docker/)                |
| A platform that deploys from GitHub   | Railway, Render                               | [Railway](/hosting/railway/), [Render](/hosting/render/) |
| Servers in several regions            | Fly.io                                        | [Fly.io](/hosting/fly/)                                  |

A VPS costs least and gives you full control, but you look after the server. A platform
costs a little more and looks after the server for you.

Then follow [Running Lintel on a server](/hosting/) to set it up.
