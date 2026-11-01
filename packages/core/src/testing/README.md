# Testing helpers

Shared setup for tests. Nothing here is part of the running server, so the production
build (`tsconfig.build.json`) leaves this folder out.

## Tests that need a database

They run on the built-in database (PGlite) by default, so `pnpm test` needs nothing
installed. `global-setup.ts` migrates one built-in database before the run, and each test
file starts from a copy of it in memory, which takes a fraction of a second.

To run them against a real Postgres server instead, as CI does, set `TEST_DATABASE_URL`.
It is emptied before every test, so use a database just for tests:

```bash
createdb lintel_test   # or: docker compose exec postgres createdb -U lintel lintel_test
TEST_DATABASE_URL=postgres://lintel:lintel@localhost:5432/lintel_test pnpm test
```

A few setup tests (connecting to Postgres with the setup screen's fields, creating a
database) only run when `TEST_DATABASE_URL` is set. That user must be allowed to create
roles and databases, as the Docker and CI `lintel` user is.

```ts
describe("signing in", () => {
  const testDatabase = useTestDatabase(); // opens it, empties it before each test

  it("...", async () => {
    const server = buildServer({ database: testDatabase.activeDatabase, ... });
  });
});
```

| File               | What it does                                                          |
| ------------------ | --------------------------------------------------------------------- |
| `test-database.ts` | `useTestDatabase`, `openTestDatabase`, `emptyAllTables`               |
| `test-users.ts`    | `createTestUser` with given permissions, `signInAndGetCookies`        |
| `test-server.ts`   | `startTestServer` (timed jobs off) and `requestsAs` a signed-in user  |
| `global-setup.ts`  | Migrates the test databases once before all tests (see vitest.config) |
