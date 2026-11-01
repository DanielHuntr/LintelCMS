---
title: Architecture
description: The packages, how a request flows, and the decisions behind them.
since: "0.1"
---

## The packages

| Path                     | What it is                                                                     |
| ------------------------ | ------------------------------------------------------------------------------ |
| `packages/core`          | The API: Fastify 5, Drizzle ORM, Zod 4; PGlite or Postgres                     |
| `packages/admin`         | The admin: React 19, Vite, TanStack Router and Query, Tailwind 4               |
| `packages/docs`          | These docs (Astro Starlight), also bundled into the admin's help               |
| `packages/motion`        | The animation runtime, schemas and presets ([spec](/building/animation-spec/)) |
| `packages/motion-editor` | The animation studio (React), embedded by the page builder                     |
| `starters/nextjs`        | A Next.js site that reads the delivery API                                     |
| `docs/decisions`         | Decision records: why the big choices were made                                |

pnpm workspaces link the packages; Turborepo runs `build`, `typecheck`, `test` and `dev`
across them in dependency order.

## How the pieces talk

```text
 Editors ──> admin (browser) ──cookie session──> /auth, /collections, /entries, /media ...
                                                      │
                                                  @lintel/core ──> PGlite or Postgres
                                                      │
 Visitors ──> your website (server) ──no auth──> /delivery/:collection[/:slug]
                                              └─> /media/:id/file?w=&h=  (images)
```

- The admin signs in with a server-side session in an HTTP-only cookie
  ([decision 0004](https://github.com/DanielHuntr/lintelcms/blob/main/docs/decisions/0004-sessions-not-jwt.md)).
  Every route checks a permission such as `entries:publish`.
- Websites read the [delivery API](/building/delivery-api/), which needs no key because it
  only serves published content.

## Ideas worth knowing

**Working copy and published copy.** An entry's `data` is what editors change;
publishing copies it to `publishedData`, the only thing the delivery API reads
([decision 0006](https://github.com/DanielHuntr/lintelcms/blob/main/docs/decisions/0006-published-copy-of-entries.md)).

**Blueprints and collections.** A blueprint is a list of fields; a collection groups
entries that share one, with a `structure` (`tree`, `dated` or `flat`) and a
`routePattern` such as `/blog/{slug}`. The admin calls the pair a "content type".

**Fieldtypes.** Each kind of field (text, rich text, image...) defines its options and a Zod
schema for its value, so one function checks an entry against any blueprint.

**Tenants.** Every table has a `tenantId` column from day one, so one install can later
serve several sites ([decision 0003](https://github.com/DanielHuntr/lintelcms/blob/main/docs/decisions/0003-tenant-column-everywhere.md)).

**One visible list.** Routes, fieldtypes and plugins are registered in lists you can read
(`server.ts`, `fieldtypes.registry.ts`, `plugins.registry.ts`), never discovered from
file names.

**Built-in database.** PGlite by default, Postgres one setting away; the same migrations
run on both ([decision 0005](https://github.com/DanielHuntr/lintelcms/blob/main/docs/decisions/0005-built-in-database.md)).
