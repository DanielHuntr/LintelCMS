# Production

Running Lintel on a server. `pnpm build && pnpm start` (and the Docker image) start one
Node process that serves everything:

| Address         | What                                                         |
| --------------- | ------------------------------------------------------------ |
| `/health`       | 200 while the process runs (uptime checks)                   |
| `/ready`        | 200 when the database, its tables and storage work, else 503 |
| `/api/...`      | The API: the same routes `pnpm dev` serves at the root       |
| `/admin/...`    | The built admin (`ADMIN_PATH`), from `packages/admin/dist`   |
| everything else | The public website (a placeholder until a renderer plugs in) |

`main.ts` decides: `NODE_ENV=development` (what `pnpm dev` sets) starts only the API, beside
Vite's admin server; anything else starts this. The API moves under `/api` so the website
can use every other address, including `/search` or `/media`. See
`docs/decisions/0011-one-process-in-production.md`.

## What it does for you

- **Settings checked at start** (`production.config.ts`, part of `src/config.ts`). Every
  mistake is listed at once by name, in plain English, and the server doesn't start. A
  public `http://` address is refused, because browsers would drop the sign-in cookie.
- **HTTPS and proxies.** `TRUST_PROXY` (by default: proxies on this machine or a private
  network) decides whose `X-Forwarded-For` and `X-Forwarded-Proto` to believe, so rate
  limits see real visitors. Cookies are `Secure` whenever `PUBLIC_URL` is `https://`.
- **Compression** (gzip and brotli, `@fastify/compress`) for anything over 1 KB.
- **Caching.** API answers are `no-store` unless a route says otherwise (delivery, files).
  The admin's fingerprinted files are cached for a year; its `index.html` is `no-cache`.
- **Logs** are JSON lines (pino), each with `requestId`. The id comes from the proxy's
  `x-request-id` when it looks safe, otherwise a new UUID, and is sent back in
  `x-request-id`. Cookies, authorization headers, passwords and tokens are `[hidden]`.
- **Graceful shutdown.** On SIGTERM or Ctrl+C new requests get 503, requests in progress
  finish, then the database closes. After `SHUTDOWN_TIMEOUT_SECONDS` (10) it exits anyway.
- **Storage is checked at start**, so a wrong bucket or key stops the deploy with a reason.

## The website hook

`public-site.ts` defines `PublicSite`: a Fastify plugin registered last, at the root, and
told where the API and the admin are. The placeholder answers `/` with a "coming soon" page
and forwards `/sitemap.xml` and `/robots.txt` to the SEO plugin. A site renderer replaces it:

```ts
await startProductionServer(config, siteRenderer);
// or, in tests: buildProductionServer({ ..., publicSite: siteRenderer })
```

A separately hosted site (the Next.js starter) doesn't use the hook; it reads
`<PUBLIC_URL>/api`.

## Files

| File                         | What it does                                                    |
| ---------------------------- | --------------------------------------------------------------- |
| `production.config.ts`       | The settings, their rules, and the addresses worked out of them |
| `start-production-server.ts` | `pnpm start`: storage, database, server, listen, log, shutdown  |
| `production-server.ts`       | Puts the API, the admin and the website on one server           |
| `admin-app.ts`               | Serves the built admin and tells it its path and the API's      |
| `public-site.ts`             | The website hook and the placeholder page                       |
| `logging.ts`                 | JSON logs and what they hide                                    |
| `graceful-shutdown.ts`       | Finishing requests before stopping                              |
