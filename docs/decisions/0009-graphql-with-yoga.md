# 9. GraphQL delivery with GraphQL Yoga

Date: 2026-11-01

## Decision

The GraphQL delivery API at `/graphql` is served by GraphQL Yoga (from The Guild) inside
the Fastify server, on graphql-js 16. The schema is built in code from the collections and
blueprints with graphql-js's own type classes, and rebuilt when one of them changes. Query
depth and cost are limited by two small validation rules of our own
(`packages/core/src/graphql/graphql-limits.ts`).

## Why

- **The schema changes while the server runs.** Editors add fields in the blueprint
  builder. Yoga takes a schema per request (`schema: async () => ...`), so we hand it the
  current one and keep it until the content model changes. Mercurius builds its schema at
  start-up and needs `replaceSchema` calls from wherever content types change, which would
  tie the blueprint code to GraphQL.
- **Well maintained, and not tied to one server.** Yoga is actively released, supports
  graphql-js 16 and 17, follows the GraphQL over HTTP spec, and runs on Fastify through
  `handleNodeRequestAndResponse`, so it would come with us if the HTTP layer changed.
- **GraphiQL included.** It ships GraphiQL, which we serve in development only.
- **Plain graphql-js types, no schema language.** Building types in code from field
  definitions is direct and typed; generating SDL strings and parsing them back would add
  a step where names could go wrong.
- **Our own limit rules.** We tried graphql-armor's depth and cost plugins. They are
  CommonJS-only, which in our ESM setup loads a second copy of graphql-js and breaks
  `instanceof` checks in tests. The rules we need are about 120 lines, count list sizes
  from `perPage` (which a generic cost rule doesn't know about), and are tested on their
  own.

## Alternatives considered

- **Mercurius**: Fastify-native, fast, with built-in depth limits, but a static schema
  (see above) and Fastify-only.
- **Apollo Server**: heavier, its Fastify integration is a separate community package,
  and its newer features push towards Apollo's hosted tools.
- **Pothos or TypeGraphQL**: good for schemas written by developers; ours is generated
  from data, which plain graphql-js handles without another layer.
- **graphql 17**: supported by Yoga, but released recently; 16 is what the rest of the
  ecosystem (code generators, editors) expects today. Moving later is a version bump.
