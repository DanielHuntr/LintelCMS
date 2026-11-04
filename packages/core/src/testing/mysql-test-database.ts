import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { createConnection } from "mysql2/promise";
import * as schema from "../database/schema.js";

/** Removes every row from every table, in one trip to the server: this runs before each test. */
export async function emptyEveryMysqlTable(url: string): Promise<void> {
  const deletes = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => `delete from \`${getTableName(table)}\`;`);
  const connection = await createConnection({
    uri: url.replace(/^mariadb:/, "mysql:"),
    multipleStatements: true,
  });
  try {
    // For this connection only, so the order doesn't matter.
    await connection.query(`set foreign_key_checks = 0; ${deletes.join(" ")}`);
  } finally {
    await connection.end();
  }
}
