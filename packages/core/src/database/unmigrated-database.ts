import { openBuiltInDatabase } from "./built-in-database.js";
import type { OpenedDatabase } from "./client.js";
import { type LintelFolder, readSavedDatabaseChoice } from "./database-choice.js";
import { buildPostgresUrl, checkPostgresConnection, connectToPostgres } from "./postgres-database.js";

/**
 * Opens the database the server would use (DATABASE_URL, the setup screen's choice, then
 * the built-in one) without bringing its tables up to date, for `lintel doctor` and
 * `lintel migrate --status`, which report on the tables rather than change them.
 */
export interface UnmigratedDatabase {
  opened: OpenedDatabase;
  /** Where the choice came from, in words for the terminal. */
  description: string;
}

export async function openWithoutMigrating(
  databaseUrl: string | undefined,
  lintelFolder: LintelFolder,
): Promise<UnmigratedDatabase> {
  if (databaseUrl) {
    await checkPostgresConnection(databaseUrl, { connectTimeoutSeconds: 5 });
    return { opened: connectToPostgres(databaseUrl), description: "the Postgres database in DATABASE_URL" };
  }
  const choice = readSavedDatabaseChoice(lintelFolder);
  if (choice?.kind === "postgres") {
    const url = buildPostgresUrl(choice);
    await checkPostgresConnection(url, { connectTimeoutSeconds: 5 });
    return {
      opened: connectToPostgres(url),
      description: "the Postgres database chosen during setup",
    };
  }
  return {
    opened: await openBuiltInDatabase({ dataFolder: lintelFolder.dataFolder }),
    description: "the built-in database in .lintel/data",
  };
}
