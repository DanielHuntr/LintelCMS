---
title: Deploy with Laravel Forge
description: Run Lintel on a server managed by Laravel Forge, with Nginx, a daemon and SSL.
since: "0.1"
sidebar:
  label: Laravel Forge
---

Laravel Forge sets up and looks after servers for you. It is made for PHP, but its
servers come with Node.js, Nginx and Supervisor, which is everything Lintel needs. Lintel
runs as a Forge **daemon** on port 4000 and Nginx passes visitors to it.

## 1. Create the server

In Forge, click **Create Server**, choose your provider and the **App Server** type, and
pick at least 1 GB of memory. When it is ready, open the server's **PHP** tab only if you
also host PHP sites; Lintel doesn't use PHP.

Check Node.js: in the server's **Packages** (or **Node**) settings choose **Node.js 22**
or newer. Then enable pnpm once, from the server's terminal (**Commands** tab works too):

```bash
corepack enable --install-directory ~/.local/bin pnpm
```

## 2. Create the site

Click **New Site**, enter your domain (such as `cms.example.com`), and choose the
**Static HTML** project type with the web directory `/`. Then open the site, choose
**Git Repository**, enter `DanielHuntr/lintelcms` (or your own fork) and the branch, and
untick **Install Composer Dependencies**.

## 3. Point Nginx at Lintel

Open the site's **Nginx** settings (Edit Files, then Edit Nginx Configuration). Keep the
lines Forge wrote for SSL (`include forge-conf/...`), and replace the `location` blocks
with one that passes everything to Lintel:

```nginx
    # Lintel serves the website, /admin and /api from one port.
    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;
        proxy_read_timeout 120s;
    }
```

Remove the `location ~ \.php$` block and the `index` line if they are there. If you
create many Lintel sites, save this as a **Nginx Template** on the server and choose it
when creating each site.

## 4. Add the settings

Open the site's **Environment** tab and set:

```bash
PUBLIC_URL=https://cms.example.com
HOST=127.0.0.1
PORT=4000
# Outside the code folder, so deploys never touch your content.
LINTEL_FOLDER=/home/forge/lintel-data
```

Leave `DATABASE_URL` out to use the built-in database. To use a database the server
already has, create a PostgreSQL database in Forge's **Database** tab (if the server was
created with PostgreSQL) and add `DATABASE_URL=postgres://forge:PASSWORD@127.0.0.1:5432/lintel`.

## 5. The deploy script

Open the site's **Deployments** tab and replace the script with:

```bash
cd /home/forge/cms.example.com
git pull origin $FORGE_SITE_BRANCH

pnpm install --frozen-lockfile
pnpm build

# Supervisor starts Lintel again straight away; it finishes requests in progress first.
pkill -TERM -u forge -f "node dist/main.js" || true
```

Click **Deploy Now**. The first build takes a few minutes.

## 6. Run Lintel as a daemon

Open the server's **Daemons** tab and add:

| Field         | Value                         |
| ------------- | ----------------------------- |
| **Command**   | `pnpm start`                  |
| **Directory** | `/home/forge/cms.example.com` |
| **User**      | `forge`                       |
| **Processes** | `1`                           |
| **Stop wait** | `15` seconds                  |

Supervisor starts Lintel now and after every reboot, and restarts it if it stops. Lintel
finishes requests in progress before it stops, within `SHUTDOWN_TIMEOUT_SECONDS` (10).

## 7. Turn on SSL

Open the site's **SSL** tab, choose **Let's Encrypt** and click **Obtain Certificate**.
Forge renews it for you. Then open `https://cms.example.com/admin`. The setup wizard asks
for a setup code: it is in the daemon's log (**Daemons**, then the log icon) and in
`/home/forge/lintel-data/setup-code.txt`.

## Zero-downtime deployments

Lintel runs as **one process**, and the built-in database can only be open in one process
at a time, so a deploy has a few seconds while Lintel restarts. Visitors in that moment
get a 502 from Nginx; browsers retry quietly for most of them.

If you turn on Forge's **zero-downtime deployments**, each deploy goes into a new
`releases/` folder. That works with Lintel as long as `LINTEL_FOLDER` is outside the
site folder (as in step 4), the daemon's directory is the site's `current` folder, and
the restart line stays at the end of the deploy script.

## Updating

Click **Deploy Now** (or turn on **Quick Deploy** to deploy on every push to the branch).
Read [Keeping Lintel updated](/hosting/updating/) first.

## If something goes wrong

- **502 Bad Gateway**: Lintel isn't running. The daemon's log shows why; often a setting
  it explains in one line, or the build in the deploy log failed.
- **"Port 4000 is already in use"**: two daemons run Lintel. Keep one, with Processes `1`.
- **Sign-in doesn't stick**: `PUBLIC_URL` must start with `https://`, and SSL must be on.
