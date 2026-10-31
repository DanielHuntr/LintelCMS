import { loadConfig, loadProjectEnvFile } from "../config.js";
import { describeActiveDatabase } from "../database/active-database.js";
import { openConfiguredDatabase, runWithFriendlyErrors } from "../startup.js";

/**
 * Creates or updates the database's tables:
 *
 *   pnpm --filter @lintel/core db:migrate
 *
 * The server already does this every time it starts, so this is only for people who
 * like to run migrations as a separate step (before a deploy, say). It uses the same
 * database the server would: DATABASE_URL, then the setup screen's choice, then the
 * built-in database. Unlike `drizzle-kit migrate`, it explains connection problems.
 */
await runWithFriendlyErrors(async () => {
  loadProjectEnvFile();
  const activeDatabase = await openConfiguredDatabase(loadConfig());
  try {
    process.stdout.write(`${describeActiveDatabase(activeDatabase)}\n`);
    process.stdout.write("The database's tables are up to date.\n");
  } finally {
    await activeDatabase.close();
  }
});
