---
title: Hosting on Render
description: Deploying Lintel to Render as a Docker web service with Render Postgres.
since: "0.1"
sidebar:
  label: Render
---

[Render](https://render.com) builds Lintel from GitHub and redeploys on every push.

## 1. The database

In the Render dashboard, choose **New → Postgres**. Pick the same region you'll use for
Lintel. When it is ready, copy its **Internal Database URL**.

## 2. The web service

1. Choose **New → Web Service** and connect your copy of the Lintel repository.
2. **Language**: Docker. Render finds the `Dockerfile`.
3. **Environment variables**:

   | Variable       | Value                                                     |
   | -------------- | --------------------------------------------------------- |
   | `DATABASE_URL` | The Internal Database URL from step 1                     |
   | `PUBLIC_URL`   | `https://<your service>.onrender.com`, or your own domain |

   Render sets `PORT` by itself, and Lintel uses it.

4. Under **Advanced**, set the **Health Check Path** to `/ready`.

## 3. Keep uploads

Render's disks need a paid instance. Under **Advanced → Disks**, add one with the mount
path `/data`. On a free instance there is no disk, so uploads would vanish on each deploy;
keep them in a bucket instead, such as Cloudflare R2, which has a free tier. See
[Uploaded files](/hosting/environment-variables/#uploaded-files).

Free instances also go to sleep when nobody visits, so the first visit after a while is
slow. Use a paid instance for a site people rely on.

## 4. Your domain and setup

Add your domain under **Settings → Custom Domains** and follow the DNS instructions;
Render handles HTTPS. Update `PUBLIC_URL` to match. Then open `/admin` on your address. The
setup code is in the service's **Logs** (search for `setupCode`).

## Running commands

Use the service's **Shell** tab (paid instances), for example:

```bash
node dist/scripts/reset-password.js --email you@example.com
```
