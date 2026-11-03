# 62. Ready-made deploy recipes, and checking a server in plain words

Date: 2026-11-03

## Context

People who need Lintel running on a server (for the shop in designs, visitor counts, A/B tests
or member logins) had guides for Railway, Render and Fly.io, but each meant typing settings into
a dashboard, and nothing could say what a server lacked once Lintel was on it. Building the
image also showed the production Dockerfile hadn't kept up with the workspace: it stopped at the
first build step.

## Decision

- **Settings files in the repository root.** `render.yaml`, `railway.json` and `fly.toml` sit
  where each platform looks for them, with `deploy/digitalocean/user-data.sh` for a droplet. All
  of them build the one `Dockerfile`, check `/ready` and keep `/data`.
- **Lintel takes the address the platform gave it.** Without `PUBLIC_URL`, it reads
  `RENDER_EXTERNAL_URL`, `RAILWAY_PUBLIC_DOMAIN` or `FLY_APP_NAME`, so a first deploy needs no
  address typed in. `PUBLIC_URL` always wins, for people's own domains.
- **One check, two ways in.** `src/server-check` runs the existing hosting checker
  (`lintel-check.cjs`) and adds the database really in use. `lintel check` works when Lintel
  won't start; Settings → This server works for people who never open a terminal. The checker
  stays one plain file, so it can still be uploaded before anything is installed.
- **The command connects to Postgres itself** instead of opening Lintel's database code: the
  built-in database can only be opened by one program, and the running Lintel has it.
- **We recommend these companies; we don't host.** Lintel offers no hosting of its own.

## Consequences

- The recipes can only be tested as far as parsing them and running the same image locally; a
  platform changing its file format shows up only on a real deploy.
- Railway's config file can't hold variables or volumes, so its guide still has those steps.
- `render.yaml` uses a paid instance, because only those can have a disk.
- The Dockerfile lists each workspace package; a new package must be added there.
  `deploy-recipes.test.ts` checks the main ones.
