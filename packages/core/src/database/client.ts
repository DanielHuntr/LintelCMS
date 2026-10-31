import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDatabase>["database"];

/**
 * Opens the connection pool. Returns `close` as well so the server can shut down cleanly.
 */
export function createDatabase(databaseUrl: string) {
  const connection = postgres(databaseUrl);
  const database = drizzle(connection, { schema });

  return {
    database,
    close: () => connection.end(),
  };
}
