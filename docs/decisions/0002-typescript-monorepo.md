# 2. One TypeScript monorepo: Fastify, Drizzle, Postgres, React

Date: 2026-10-31

## Decision

- pnpm workspaces + Turborepo, one repository for every package.
- API: Fastify with Zod schemas. Database: PostgreSQL through Drizzle ORM.
- Admin: React with Vite, TanStack Router and Tailwind CSS.
- TypeScript 6 in strict mode everywhere.

## Why

One language from database to browser means one Zod schema can validate the API and type
the admin. Postgres gives hard guarantees for money and stock, while JSONB columns hold
flexible content fields. React has the deepest ecosystem for the hardest parts of the
product: rich text, drag and drop, and the visual builder.

## Alternatives considered

- **Vue 3 admin** (as Statamic uses): good, but React's editor and canvas libraries are wider.
- **NestJS**: more structure, but heavier; Fastify plus our folder rules is easier to read.
- **TypeScript 7** (the native compiler): not yet supported by typescript-eslint; revisit
  when it is.
