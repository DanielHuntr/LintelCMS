# @lintel/core

The API server: content model, entries, users and permissions.

## Where things live

Code is grouped by feature, not by file type. Each feature folder owns its table,
its routes and its tests.

| Folder               | What it does                                           |
| -------------------- | ------------------------------------------------------ |
| `src/sites`          | Sites and languages served by this install             |
| `src/users`          | People who sign in to the admin                        |
| `src/roles`          | Roles and the permission check used everywhere         |
| `src/auth`           | Sign-in, sign-out, `/auth/me` and route guards         |
| `src/setup`          | First-run setup: database, first admin, site type      |
| `src/plugins`        | Which features (blog, shop...) are switched on         |
| `src/settings`       | Small site-wide settings stored as JSON                |
| `src/sessions`       | Server-side sessions behind the sign-in cookie         |
| `src/fieldtypes`     | Kinds of field, and checking entries against them      |
| `src/blueprints`     | Content types: the fields a kind of content has        |
| `src/collections`    | Groups of entries (Pages, Blog...) and the defaults    |
| `src/entries`        | Entries, publishing, ordering and revisions            |
| `src/delivery`       | The public API sites read published content from       |
| `src/graphql`        | The GraphQL delivery API, typed from the blueprints    |
| `src/openapi`        | The OpenAPI document for the REST API                  |
| `src/api-tokens`     | Bearer tokens for websites, apps and scripts           |
| `src/webhooks`       | Signed requests to other services when content changes |
| `src/content-events` | Publish, delete and upload events, and who hears them  |
| `src/seo`            | The SEO plugin: page SEO, sitemap, robots, redirects   |
| `src/scheduler`      | Timed jobs, such as publishing scheduled entries       |
| `src/media`          | Uploads, image resizing and the storage driver         |
| `src/health`         | `GET /health` for uptime checks                        |
| `src/database`       | Built-in or Postgres, choosing one, friendly errors    |
| `src/http`           | Error responses and request parsing shared by routes   |
| `src/scripts`        | `create-admin`, `reset-password`, `db:migrate`         |
| `src/testing`        | Test database helpers                                  |

As features grow, each folder follows the same shape:

```text
orders/
  README.md              what it is and how it flows
  orders.table.ts        database table
  orders.schema.ts       Zod schema for input and output
  orders.routes.ts       HTTP only: parse, check permission, call the service
  orders.service.ts      business rules
  orders.repository.ts   database reads and writes
  orders.test.ts         tests that double as usage examples
```

## Commands

Run from this folder, or from the repository root with `pnpm --filter @lintel/core <command>`.

```bash
pnpm dev            # start the API on http://localhost:4000 (no .env needed)
pnpm test           # run tests on the built-in database (TEST_DATABASE_URL for Postgres)
pnpm db:generate --name <what_changed>   # create a migration after changing a *.table.ts file
pnpm db:migrate     # apply migrations now (the server also does this on every start)
pnpm create-admin --email <email> --name "<name>"   # create a Super admin
pnpm reset-password --email <email>                 # new password, signs the user out everywhere
```

Uploaded files go to `.lintel/uploads` and resized images to `.lintel/cache/media`.
Set `API_PUBLIC_URL` when browsers reach the API at another address than
`http://localhost:<API_PORT>`; it is used in the URLs of uploaded files.

`WEBHOOKS_ALLOW_PRIVATE_ADDRESSES=true` lets webhooks go to localhost and private network
addresses, for testing a receiver on your own machine; leave it off on a real server.
GraphiQL is served at `/graphql` when `NODE_ENV=development`.

Every setting has a default, so no `.env` is needed. If the root `.env` exists it is
read; real environment variables win over it. Without `DATABASE_URL` the API uses the
database chosen on the setup screen, or else the built-in one (see `src/database`).
`pnpm dev` runs with `NODE_ENV=development` (from `development.env`) so the sign-in
cookie works over plain `http://localhost`.
