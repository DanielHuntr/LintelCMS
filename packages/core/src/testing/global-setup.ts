import { applyMigrations, testDatabaseUrl } from "./test-database.js";

/**
 * Runs once before all test files (see vitest.config.ts). Brings the test database's
 * tables up to date, or explains why the database tests are being skipped.
 */
export default async function setup(): Promise<void> {
  if (!testDatabaseUrl) {
    console.warn(
      "\nTEST_DATABASE_URL is not set, so tests that need Postgres are skipped.\n" +
        "To run them: TEST_DATABASE_URL=postgres://lintel:lintel@localhost:5432/lintel_test pnpm test\n",
    );
    return;
  }

  await applyMigrations(testDatabaseUrl);
}
