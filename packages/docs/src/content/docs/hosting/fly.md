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

Lintel's repository has a `fly.toml`. Change `app` to a name of your own and `primary_region`
to [one near your visitors](https://fly.io/docs/reference/regions/), then:

```bash
fly launch --copy-config --no-deploy
```

Say no to the offers of extra services for now.

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
fly deploy
```

Open `https://my-lintel.fly.dev/admin`. The setup code is in `fly logs` (search for
`setupCode`). Lintel uses its `fly.dev` address by itself. For your own domain:
`fly certs add cms.example.com`, follow the DNS instructions, then
`fly secrets set PUBLIC_URL=https://cms.example.com`.

## Running commands

```bash
fly ssh console -C "node dist/scripts/reset-password.js --email you@example.com"
```
