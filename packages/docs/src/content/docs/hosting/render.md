---
title: Hosting on Render
description: Deploying Lintel to Render as a Docker web service with Render Postgres.
since: "0.1"
sidebar:
  label: Render
---

[Render](https://render.com) builds Lintel from GitHub and redeploys on every push.

## The quick way: the Blueprint

Lintel's repository has a `render.yaml` that sets up the web service, its disk and a Postgres
database together.

1. Fork or push Lintel to your own GitHub account.
2. In Render, choose **New → Blueprint** and pick your copy. (Or use
   [Deploy to Render](https://render.com/deploy?repo=https://github.com/DanielHuntr/lintelcms)
   and change the repository address to yours.)
3. Check the plans it shows and choose **Apply**.

That's all the settings there are: Lintel uses the `onrender.com` address Render gave it, so
there's no address to type. Open `/admin` on that address when the deploy has finished; the
setup code is in the service's **Logs** (search for `setupCode`). Then go to
[your domain](#4-your-domain-and-setup).

The Blueprint uses a paid instance, because only those can have a disk. The steps below do the
same by hand, if you'd rather choose for yourself.

## 1. The database (by hand)

In the Render dashboard, choose **New → Postgres**. Pick the same region you'll use for
Lintel. When it is ready, copy its **Internal Database URL**.

## 2. The web service (by hand)

1. Choose **New → Web Service** and connect your copy of the Lintel repository.
2. **Language**: Docker. Render finds the `Dockerfile`.
3. **Environment variables**:

   | Variable       | Value                                                       |
   | -------------- | ----------------------------------------------------------- |
   | `DATABASE_URL` | The Internal Database URL from step 1                       |
   | `PUBLIC_URL`   | Only for your own domain; Lintel knows its onrender.com one |

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
