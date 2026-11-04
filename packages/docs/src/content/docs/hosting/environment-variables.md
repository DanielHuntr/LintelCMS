---
title: Environment variables reference
description: Every setting Lintel reads, what it does and its default.
since: "0.1"
sidebar:
  label: Environment variables
---

Lintel is configured with environment variables: in `deploy/.env` with Docker Compose, in
the dashboard on Railway, Render and Fly.io, or in a `.env` file at the repository root.
Every setting has a default. An empty line, such as `S3_BUCKET=`, counts as not set.

When Lintel starts, it checks them all. If any is wrong, it doesn't start, and it lists each
problem by name:

```text
Lintel can't start because some settings are wrong:
  - PUBLIC_URL: Starts with http://, so browsers would refuse the sign-in cookie...
  - S3_BUCKET: STORAGE_DRIVER is s3, so Lintel needs the name of the bucket to keep files in
```

Yes-or-no settings accept `true`/`false`, `yes`/`no`, `on`/`off` or `1`/`0`.

## The basics

| Variable       | Default                     | What it does                                                                         |
| -------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `PUBLIC_URL`   | `http://localhost:<port>`   | The address people visit, such as `https://example.com`, with no path. Used in links |
| `DATABASE_URL` | none: the built-in database | A Postgres, MySQL or MariaDB address. Use one on any real server                     |
| `PORT`         | `API_PORT`, else `4000`     | The port to listen on. Hosting platforms set it for you                              |
| `HOST`         | `0.0.0.0`                   | The network address to listen on                                                     |
| `ADMIN_PATH`   | `/admin`                    | Where the admin lives. Can't be `/api`                                               |
| `NODE_ENV`     | `production`                | `development` runs only the API, for `pnpm dev`. Leave it alone on a server          |

In a database address, write `#`, `@` and `/` in the password as `%23`, `%40` and `%2F`. A
MySQL or MariaDB address looks like `mysql://user:password@localhost:3306/lintel`, and
`mariadb://` means the same. Add `?ssl=require` for an encrypted connection.

## Running behind a proxy

| Variable                   | Default                            | What it does                                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRUST_PROXY`              | `loopback, linklocal, uniquelocal` | Which proxies to believe about the visitor's address and HTTPS. The default trusts this machine and private networks, which suits Caddy and the hosting platforms. `true`, `false`, a number of proxies, or a list of addresses |
| `ALLOW_INSECURE_HTTP`      | `false`                            | Allows a `PUBLIC_URL` starting with `http://`. Sign-in then travels unencrypted: test servers only                                                                                                                              |
| `API_PUBLIC_URL`           | `<PUBLIC_URL>/api`                 | Only if the API is reached at a different address than the site                                                                                                                                                                 |
| `SHUTDOWN_TIMEOUT_SECONDS` | `10`                               | On a restart, how long requests in progress get to finish                                                                                                                                                                       |

## Where files are kept

| Variable             | Default                                         | What it does                                                        |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| `LINTEL_FOLDER`      | `.lintel` (in Docker, `/data`)                  | The built-in database, uploads, resized images and the email outbox |
| `ADMIN_BUILD_FOLDER` | `packages/admin/dist` (in Docker, `/app/admin`) | Where the built admin is                                            |

## Scheduled jobs and shared hosting

| Variable        | Default                            | What it does                                                                                                                                 |
| --------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `CRON_SECRET`   | made for you, in `cron-secret.txt` | The secret a cron job sends to `POST /api/system/run-scheduled-jobs`. At least 24 characters. `pnpm lintel cron --print-line` shows the line |
| `LINTEL_LISTEN` | worked out                         | Only for the hosting package's `app.js`: `false` exports a request handler without listening, `true` always listens on `PORT`                |

## Uploaded files

By default, uploads are kept in `<LINTEL_FOLDER>/uploads` on the server's disk. To keep
them in a bucket instead (AWS S3, Cloudflare R2, Backblaze B2 or MinIO), set
`STORAGE_DRIVER=s3` and the settings below. Keep the bucket private: Lintel serves the files.

| Variable                | Default             | What it does                                                                         |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `STORAGE_DRIVER`        | `local`             | `local` or `s3`                                                                      |
| `S3_BUCKET`             | none                | The bucket's name. Needed for `s3`                                                   |
| `S3_REGION`             | `us-east-1`         | The bucket's region. Cloudflare R2 uses `auto`                                       |
| `S3_ENDPOINT`           | none: AWS           | For anything but AWS (see below)                                                     |
| `S3_ACCESS_KEY_ID`      | none                | The access key. Leave both keys out to use the server's own AWS role                 |
| `S3_SECRET_ACCESS_KEY`  | none                | The secret that goes with it                                                         |
| `S3_FORCE_PATH_STYLE`   | on with an endpoint | Puts the bucket in the path. MinIO needs it                                          |
| `S3_KEY_PREFIX`         | none                | Keeps Lintel's files in one folder of a shared bucket, such as `lintel/`             |
| `S3_SIGNED_URLS`        | `false`             | Sends visitors straight to the bucket with short-lived links, taking load off Lintel |
| `S3_SIGNED_URL_SECONDS` | `3600`              | How long those links last                                                            |

| Service       | `S3_ENDPOINT`                                   | `S3_REGION`               |
| ------------- | ----------------------------------------------- | ------------------------- |
| Cloudflare R2 | `https://<account id>.r2.cloudflarestorage.com` | `auto`                    |
| Backblaze B2  | `https://s3.<region>.backblazeb2.com`           | the region, `us-west-004` |
| MinIO         | `http://minio:9000` (its address)               | `us-east-1`               |
| AWS S3        | leave out                                       | the bucket's region       |

The keys need permission to read, write, delete and list in that bucket. Lintel checks the
bucket when it starts and says in plain words if the name, region or keys are wrong.

### Moving existing uploads to a bucket

Set the `S3_` settings but leave `STORAGE_DRIVER` as it is, then:

```bash
pnpm media:move-to-s3 --dry-run     # see what would be copied
pnpm media:move-to-s3               # copy
```

In Docker: `docker compose -f deploy/docker-compose.yml exec lintel node dist/scripts/move-media-to-s3.js`.
Files already in the bucket are skipped, so it is safe to run again. Then set
`STORAGE_DRIVER=s3` and restart. Nothing is deleted from the disk; remove the old files
once the site looks right.

## Email

Until `EMAIL_DRIVER` is set, emails are kept in `<LINTEL_FOLDER>/outbox` and nobody is
emailed. A server logs a reminder while that is so.

| Variable                  | Default       | What it does                                                                                                             |
| ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `EMAIL_DRIVER`            | `outbox`      | `outbox`, `smtp`, `resend` or `postmark`                                                                                 |
| `EMAIL_FROM`              | a placeholder | Who emails come from: `Your Site <hello@example.com>`. Needed for any real driver, on a domain your service has verified |
| `SMTP_HOST`               | none          | The mail server, such as `smtp.mailgun.org`. Needed for `smtp`                                                           |
| `SMTP_PORT`               | `587`         | Usually 587; 465 for encrypted-from-the-start                                                                            |
| `SMTP_SECURE`             | on for 465    | Encrypt from the start. Off uses STARTTLS when the server offers it                                                      |
| `SMTP_USER`               | none          | The mail server's user name                                                                                              |
| `SMTP_PASSWORD`           | none          | Its password                                                                                                             |
| `RESEND_API_KEY`          | none          | Needed for `resend`                                                                                                      |
| `POSTMARK_SERVER_TOKEN`   | none          | Needed for `postmark`                                                                                                    |
| `POSTMARK_MESSAGE_STREAM` | `outbound`    | Which Postmark stream to send through                                                                                    |

Check your settings with `pnpm send-test-email --to you@example.com` (in Docker:
`node dist/scripts/send-test-email.js --to you@example.com`).

## Logs and other settings

| Variable                           | Default                 | What it does                                                                    |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| `LOG_LEVEL`                        | `info`                  | `error`, `warn`, `info`, `debug`, `trace` or `silent`                           |
| `WEBHOOKS_ALLOW_PRIVATE_ADDRESSES` | `false`                 | Lets webhooks go to private network addresses. For testing on your own computer |
| `SITE_PORT`                        | `3000`                  | Development only: the built-in website's own port with `pnpm dev`               |
| `API_PORT`                         | `4000`                  | The port when `PORT` isn't set                                                  |
| `ADMIN_ORIGIN`                     | `http://localhost:5173` | Development only: where Vite serves the admin                                   |

## Updates

See [Updating Lintel](/using/updating/) and [Releases and the update feed](/building/releases/).

| Variable               | Default                  | What it does                                                                               |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `UPDATE_CHECKS`        | `true`                   | `false` (or `off`) stops Lintel looking for new versions at all                            |
| `UPDATE_FEED_URL`      | Lintel's GitHub releases | Another GitHub releases address, or an agency's own feed                                   |
| `UPDATE_PUBLIC_KEY`    | Lintel's release key     | A minisign public key, for builds an agency signs itself                                   |
| `LINTEL_INSTALL_TYPE`  | worked out by Lintel     | `supervised`, `process`, `docker`, `source`, `passenger` or `forge`, if the guess is wrong |
| `LINTEL_HOME`          | the folder it runs in    | Where `lintel start` keeps `versions/` and `current`                                       |
| `LINTEL_UPDATER_URL`   | none                     | Docker only: `http://lintel-updater:8080` when the opt-in updater runs                     |
| `LINTEL_UPDATER_TOKEN` | none                     | Docker only: a long random secret shared with lintel-updater                               |

## Only for Docker Compose

`deploy/docker-compose.yml` also reads `LINTEL_DOMAIN` (the domain Caddy gets a
certificate for), `POSTGRES_PASSWORD` (the database's password, which it puts into
`DATABASE_URL` for you), `LINTEL_PORT` (the port on the server itself, `4000`) and
`LINTEL_CADDYFILE` (which Caddyfile to use; `deploy/install.sh` writes its own).
With `--profile updater` it also reads `LINTEL_REPO_PATH`, the repository's full path on
the server, for the lintel-updater service.
