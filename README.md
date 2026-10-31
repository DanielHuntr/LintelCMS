# Lintel

A self-hosted CMS with a visual builder, an animation studio and built-in commerce,
written in TypeScript and React.

Lintel is early. This repository currently holds the foundations: the monorepo, the API
server skeleton, the first database schema and the admin shell.

## Getting started

You need Node 22, pnpm 10 and Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up                                  # start Postgres and Redis
pnpm --filter @lintel/core db:migrate       # create the tables
pnpm dev                                    # API on :4000, admin on :5173
```

Open http://localhost:5173 for the admin and http://localhost:4000/health for the API.

## What's in here

| Path              | What it is                                                 |
| ----------------- | ---------------------------------------------------------- |
| `packages/core`   | The API server: content model, entries, users, permissions |
| `packages/admin`  | The control panel (React)                                  |
| `docs/decisions`  | Why the big choices were made                              |
| `CONTRIBUTING.md` | How code is written here. Read this first                  |

## Everyday commands

```bash
pnpm test         # all tests
pnpm typecheck    # TypeScript in every package
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm build        # production builds
```

A pre-commit hook runs ESLint and Prettier on the files you change.
