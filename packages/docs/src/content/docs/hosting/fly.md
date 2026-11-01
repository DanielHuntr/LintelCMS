---
title: Hosting on Fly.io
description: Deploying Lintel to Fly.io with a volume and Fly's Postgres.
since: "0.1"
sidebar:
  label: Fly.io
---

[Fly.io](https://fly.io) runs Lintel's Docker image on servers in the region you pick.
You work from the terminal with the `fly` command.

## 1. Install and sign in

Install `flyctl` as [Fly's docs](https://fly.io/docs/flyctl/install/) describe, then:

```bash
fly auth login
```

## 2. Create the app

From your copy of the Lintel repository:

```bash
fly launch --no-deploy
```

Accept the detected `Dockerfile`, and say no to the offers of extra services for now.
This writes a `fly.toml`. Make sure it contains these parts (change `app` and
`primary_region` to yours):

```toml
app = "my-lintel"
primary_region = "lhr"

[http_service]
  internal_port = 4000
  force_https = true
  auto_stop_machines = "off"
  min_machines_running = 1

  [[http_service.checks]]
    method = "GET"
    path = "/ready"
    interval = "15s"
    timeout = "5s"
    grace_period = "30s"

[mounts]
  source = "lintel_data"
  destination = "/data"
```

## 3. Storage and database

```bash
fly volumes create lintel_data --size 1
fly postgres create          # follow the questions; note the name you give it
fly postgres attach <that name>
```

`attach` sets `DATABASE_URL` for you. Fly's newer Managed Postgres works too: copy its
connection address into `DATABASE_URL` with `fly secrets set`.

Run **one** machine: a volume belongs to one machine. To run several, keep uploads in a
bucket instead (see [Uploaded files](/hosting/environment-variables/#uploaded-files)) and
drop the `[mounts]` part.

## 4. Settings and deploy

```bash
fly secrets set PUBLIC_URL=https://my-lintel.fly.dev
fly deploy
```

Open `https://my-lintel.fly.dev/admin`. The setup code is in `fly logs` (search for
`setupCode`). For your own domain: `fly certs add cms.example.com`, follow the DNS
instructions, then update `PUBLIC_URL`.

## Running commands

```bash
fly ssh console -C "node dist/scripts/reset-password.js --email you@example.com"
```
