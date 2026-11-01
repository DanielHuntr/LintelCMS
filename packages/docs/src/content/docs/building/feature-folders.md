---
title: Feature folders
description: How a feature's code is laid out, and the steps for adding one.
since: "0.1"
---

Code is grouped by feature, not by file type. Everything about one feature lives in one
folder, so you can find any feature in under a minute and read it top to bottom.

```text
packages/core/src/orders/
  README.md              what orders are, how they flow, links to related code
  orders.table.ts        the database table
  orders.schema.ts       Zod schema: the single source of truth for an order's shape
  orders.routes.ts       HTTP only: parse the request, check permission, call the service
  orders.service.ts      business rules: createOrder, refundOrder, cancelOrder
  orders.repository.ts   database reads and writes, nothing else
  orders.errors.ts       named errors with messages an editor could understand
  orders.test.ts         tests that double as usage examples
```

## Three layers, always in order

1. **Routes** parse the request with the Zod schema, check the permission with
   `requirePermission`, and call the service. No business rules.
2. **Services** hold the rules: `publishEntry`, `deleteAsset`. They take a database (or a
   transaction) as their first argument.
3. **Repositories** read and write the database with Drizzle. Nothing else.

No layer is skipped, so you always know where a rule or a query lives.

## Adding a feature

1. Make the folder under `packages/core/src/` with a `README.md`.
2. Write `<feature>.table.ts`. Every table gets `tenantId()` from `src/database/columns.ts`.
3. Export the table from `src/database/schema.ts`, then make a migration:
   `pnpm --filter @lintel/core db:generate --name add_orders`.
4. Write the schema, repository, service and routes.
5. Register the routes in `buildServer` in `src/server.ts`.
6. Throw named errors extending `HttpError` (`throw new OutOfStockError(sku)`); clients
   get `{ statusCode, code, error, message }`.
7. Test through `server.inject` with the helpers in `src/testing`.

In the admin, the same idea applies: `packages/admin/src/<feature>/` holds its screens,
`<feature>.api.ts` (fetch calls), `<feature>.queries.ts` (TanStack Query) and tests. Every
word goes through `t()` in `src/i18n/strings.ts`, and screens are built from
`src/design`.
