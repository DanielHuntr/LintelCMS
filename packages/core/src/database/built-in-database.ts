import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { MIGRATIONS_FOLDER, type OpenedDatabase } from "./client.js";
import { lockDataFolder } from "./data-folder-lock.js";
import * as schema from "./schema.js";

export interface BuiltInDatabaseOptions {
  /** Where the data lives. Leave out for a throwaway database held in memory (tests). */
  dataFolder?: string;
  /**
   * A copy of an already migrated database to start from (see `dumpDataDir` in PGlite).
   * Tests use it because creating a database from nothing takes a few seconds.
   */
  startFrom?: Blob;
}

/**
 * Opens the built-in database: real Postgres compiled to WebAssembly (PGlite), so it
 * runs anywhere Node runs with nothing else to install. Fine for one person or a small
 * team on one computer; a busy site should use its own Postgres server.
 */
export async function openBuiltInDatabase(
  options: BuiltInDatabaseOptions = {},
): Promise<OpenedDatabase> {
  const lock = options.dataFolder ? lockBesideDataFolder(options.dataFolder) : undefined;

  try {
    const client = new PGlite({
      ...(options.dataFolder ? { dataDir: options.dataFolder } : {}),
      ...(options.startFrom ? { loadDataDir: options.startFrom } : {}),
    });
    await client.waitReady;
    const database = drizzle(client, { schema });

    return {
      database,
      kind: "built-in",
      applyMigrations: () => migrate(database, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: async () => {
        // Closing lets PGlite finish writing to disk before the lock is given up.
        await client.close();
        lock?.release();
      },
    };
  } catch (error) {
    lock?.release();
    throw error;
  }
}

function lockBesideDataFolder(dataFolder: string) {
  mkdirSync(dataFolder, { recursive: true });
  // Kept outside the folder itself, which belongs to PGlite.
  return lockDataFolder(`${dataFolder}.lock`);
}
