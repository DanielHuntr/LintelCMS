---
title: Production checklist
description: What to check before real editors and visitors rely on your Lintel.
since: "0.1"
sidebar:
  label: Checklist
---

Go through this once your site is running and before you invite editors.

## Address and security

- [ ] `PUBLIC_URL` is your real address and starts with `https://`.
- [ ] The site opens with a padlock, and `http://` redirects to `https://`.
- [ ] `ALLOW_INSECURE_HTTP` is **not** set.
- [ ] `WEBHOOKS_ALLOW_PRIVATE_ADDRESSES` is **not** set.
- [ ] Every admin has a long password of their own; nobody shares an account.
- [ ] `https://your-site/ready` says `"status":"ready"`.

## Your data

- [ ] You use **Postgres** (`DATABASE_URL` is set), not the built-in database, which is
      meant for one person on one computer.
- [ ] The database is **backed up** automatically, and you have restored a backup once
      to see that it works.
- [ ] Uploaded files are on a volume or disk that survives deploys, or in a bucket
      (`STORAGE_DRIVER=s3`), and they are backed up too.
- [ ] After a deploy or restart, an uploaded image still shows.

## Email

- [ ] `EMAIL_DRIVER` is set (`smtp`, `resend` or `postmark`), and `EMAIL_FROM` is on a
      domain your email service has verified.
- [ ] `node dist/scripts/send-test-email.js --to you@example.com` (or
      `pnpm send-test-email` without Docker) arrives, and not in spam.

## Keeping an eye on it

- [ ] An uptime monitor (UptimeRobot, Better Stack and the like) checks
      `https://your-site/health` and tells you if it stops answering.
- [ ] You know where to read the logs (see your hosting guide).
- [ ] You watch the repository's releases, and have read
      [Keeping Lintel updated](/hosting/updating/).

## Your website

- [ ] If your website is a separate app, its `LINTEL_API_URL` is
      `https://your-site/api`, and its address is listed in **Settings → API access**.
