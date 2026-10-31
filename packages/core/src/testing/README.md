# Testing helpers

Shared setup for tests. Nothing here is part of the running server, so the production
build (`tsconfig.build.json`) leaves this folder out.

## Tests that need Postgres

They run against a real database named by `TEST_DATABASE_URL`. It is emptied before
every test, so use a database just for tests:

```bash
createdb lintel_test   # or: docker compose exec postgres createdb -U lintel lintel_test
TEST_DATABASE_URL=postgres://lintel:lintel@localhost:5432/lintel_test pnpm test
```

Without `TEST_DATABASE_URL` those tests are skipped and the run says so.

```ts
describeWithDatabase("signing in", () => {
  const testDatabase = useTestDatabase(); // opens it, empties it before each test

  it("...", async () => {
    const server = buildServer({ database: testDatabase.database, ... });
  });
});
```

| File               | What it does                                                    |
| ------------------ | --------------------------------------------------------------- |
| `test-database.ts` | `describeWithDatabase`, `useTestDatabase`, `applyMigrations`    |
| `global-setup.ts`  | Applies migrations once before all tests (see vitest.config.ts) |
