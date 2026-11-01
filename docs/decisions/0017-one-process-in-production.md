# 17. One process in production, with the API under /api

Date: 2026-11-01

## Decision

`pnpm start` and the Docker image run one Node process that serves the API at `/api`, the
built admin at `/admin` (`ADMIN_PATH`), `/health` and `/ready` at the root, and the public
website at every other address. `pnpm dev` keeps the API at the root of port 4000 beside
Vite's admin server. `main.ts` picks by `NODE_ENV`.

## Why

The people we build for run Lintel on a small VPS or a platform such as Railway, often
without anyone who knows reverse proxies. One process means one container, one port, one
log, one health check and one thing to restart, and the admin and API share an address,
so the sign-in cookie needs no cross-site settings.

The API moves under a prefix because the website needs the root: a page called "Search"
or "Media" must not collide with the API's `/search` or `/media`. `/health` and `/ready`
stay at the root because that is where platforms look for them. The routes themselves
don't change, only where they are mounted (`apiPrefix` in `buildServer`), so tests and
development are untouched.

The admin is built once with relative asset paths. The server adds a `<base>` tag and a
`lintel-admin` meta tag to its `index.html`, so the same build works under any path and
finds the API without being rebuilt per site.

## Consequences

- Clients reach the API at `<PUBLIC_URL>/api` in production and `http://localhost:4000` in
  development. The Next.js starter's `LINTEL_API_URL` says which.
- The built-in website plugs in as a Fastify plugin at the root
  (`src/website/built-in-public-site.ts`, through `src/production/public-site.ts`).
  A site that runs as its own app doesn't need to.
- Busy sites can still split things: `API_PUBLIC_URL` points the admin at an API on
  another address, and several Lintel processes can share one Postgres and one bucket.
