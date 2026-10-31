# How code is written in Lintel

The goal: anyone new to the codebase can find any feature in under a minute and read it
top to bottom without a guide. Every package follows the same shape, so learning one
teaches all of them.

## Folders by feature, not by file type

Everything about one feature lives in one folder:

```text
packages/core/src/orders/
  README.md              what orders are, how they flow, links to related code
  orders.table.ts        the database table
  orders.schema.ts       Zod schema: the single source of truth for an order's shape
  orders.routes.ts       HTTP only: parse the request, check permission, call the service
  orders.service.ts      business rules: createOrder, refundOrder, cancelOrder
  orders.repository.ts   database reads and writes, nothing else
  orders.test.ts         tests that double as usage examples
```

## The rules

1. **Three layers, always in the same order:** routes, then service, then repository.
   No layer is skipped, so you always know where a rule or a query lives.
2. **Plain, full names.** `refundOrder(orderId, amount)`, never `procRef(o, a)`.
   No abbreviations except well-known ones (id, url, api).
3. **One file, one job.** Aim for files under 300 lines and functions under 40.
4. **No magic.** Plugins, routes and fieldtypes are registered in one visible list
   (see `packages/core/src/server.ts`), not discovered by naming conventions.
5. **One Zod schema per entity.** Types are inferred from it, never written twice.
6. **Comments explain why, not what.** Every package and feature folder has a README.
7. **Errors are named and human.** `throw new OutOfStockError(variant.sku)`, with a message
   an editor could understand.
8. **Strict TypeScript.** No `any`. If you truly need it, add a comment saying why.
9. **Big decisions get a decision record** in `docs/decisions/`, so the reasoning
   survives the people.

## Admin screens

- No hard-coded text: add a key to `packages/admin/src/i18n/strings.ts` and call `t()`.
- Every input has a visible label; every page has one `h1`; everything works by keyboard.
- Use brand tokens (`bg-brand`) rather than fixed colours, so agencies can rebrand.
- Respect reduced motion. Motion explains cause and effect; it is never decoration.

## Before you open a pull request

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

CI runs the same checks plus a production build.
