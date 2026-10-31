import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDatabase>["database"];

/** The handle a `database.transaction(async (transaction) => ...)` callback receives. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Repositories accept either, so a service can run several of them inside one transaction
 * and have them all succeed or fail together.
 */
export type DatabaseOrTransaction = Database | Transaction;

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
