# @lintel/core

The API server: content model, entries, users and permissions.

## Where things live

Code is grouped by feature, not by file type. Each feature folder owns its table,
its routes and its tests.

| Folder            | What it does                                         |
| ----------------- | ---------------------------------------------------- |
| `src/sites`       | Sites and languages served by this install           |
| `src/users`       | People who sign in to the admin                      |
| `src/roles`       | Roles and the permission check used everywhere       |
| `src/auth`        | Sign-in, sign-out, `/auth/me` and route guards       |
| `src/sessions`    | Server-side sessions behind the sign-in cookie       |
| `src/blueprints`  | Field definitions for content                        |
| `src/collections` | Groups of entries (Pages, Blog...)                   |
| `src/entries`     | Entries and their revisions                          |
| `src/health`      | `GET /health` for uptime checks                      |
| `src/database`    | Connection, shared columns and the full schema list  |
| `src/http`        | Error responses and request parsing shared by routes |
| `src/scripts`     | Command-line tasks, such as `create-admin`           |
| `src/testing`     | Test database helpers                                |

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

```bash
pnpm dev            # start the API on http://localhost:4000 (needs .env)
pnpm test           # run tests (database tests need TEST_DATABASE_URL, see src/testing)
pnpm db:generate --name <what_changed>   # create a migration after changing a *.table.ts file
pnpm db:migrate     # apply migrations to the database in DATABASE_URL
pnpm create-admin --email <email> --name "<name>"   # create a Super admin
```

`dev` and `create-admin` read the root `.env` file if there is one; real environment
variables win over it.
