---
title: Hosting on Railway
description: Deploying Lintel to Railway from GitHub, with Railway's Postgres and a volume.
since: "0.1"
sidebar:
  label: Railway
---

[Railway](https://railway.com) builds Lintel from your GitHub repository and redeploys it
whenever you push. You pay for what Lintel uses, usually a few dollars a month for a small
site.

## 1. Create the project

1. Fork or push Lintel to your own GitHub account.
2. In Railway, choose **New Project → Deploy from GitHub repo** and pick it. Railway finds
   the `Dockerfile` and builds it.
3. In the same project, choose **New → Database → PostgreSQL**.

## 2. Settings

Open the Lintel service, then **Variables**, and add:

| Variable          | Value                            |
| ----------------- | -------------------------------- |
| `DATABASE_URL`    | `${{Postgres.DATABASE_URL}}`     |
| `PUBLIC_URL`      | Your site's address (see step 3) |
| `RAILWAY_RUN_UID` | `0`                              |

`RAILWAY_RUN_UID=0` lets the container prepare the volume when it starts; Lintel itself
then runs as an ordinary user. Railway sets `PORT` by itself, and Lintel uses it.

## 3. A public address

Under **Settings → Networking**, choose **Generate Domain** (or add your own domain and
follow Railway's DNS instructions). Put that address, with `https://`, in `PUBLIC_URL`.
Railway handles HTTPS.

## 4. Keep uploads

Right-click the Lintel service and choose **Attach Volume**, with the mount path `/data`.
Without a volume, uploaded files disappear on every deploy. Alternatively, keep them in a
bucket: see [Uploaded files](/hosting/environment-variables/#uploaded-files).

## 5. Health check

Under **Settings → Deploy**, set the **Healthcheck Path** to `/ready`. Railway then only
switches traffic to a new deploy once its database and storage work.

## 6. Set up

Open `https://your-address/admin`. The setup code is in the service's **Deploy Logs**
(search for `setupCode`).

## Running commands

Install the Railway CLI, then for example:

```bash
railway ssh -- node dist/scripts/reset-password.js --email you@example.com
```
