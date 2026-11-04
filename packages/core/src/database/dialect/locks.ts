import { sql } from "drizzle-orm";
import { mysqlTable, varchar } from "drizzle-orm/mysql-core";
import type { Transaction } from "../client.js";
import { dialectOf } from "./database-dialect.js";

/**
 * MySQL's `get_lock` belongs to the connection and stays until it is let go, so a failed
 * transaction could leave it held. A row lock ends with the transaction, as a Postgres
 * advisory lock does, so that is what MySQL uses: one row for each lock ever taken. This
 * table is MySQL's alone, and it holds nothing a backup needs.
 */
export const mysqlLocksTable = mysqlTable("lintel_locks", {
  name: varchar("name", { length: 255 }).primaryKey(),
});

/**
 * Makes other transactions asking for the same lock wait until this one ends, across several
 * server processes too. On Postgres a number is the lock's key, and text is hashed into one.
 */
export async function holdLockUntilTransactionEnds(
  transaction: Transaction,
  key: number | string,
): Promise<void> {
  if (dialectOf(transaction) === "postgres") {
    const lockKey = typeof key === "number" ? sql`${key}` : sql`hashtext(${key})`;
    await transaction.execute(sql`select pg_advisory_xact_lock(${lockKey})`);
    return;
  }
  // Takes the row's lock whether the row is new or already there.
  await transaction.execute(
    sql`insert into lintel_locks (name) values (${String(key)}) on duplicate key update name = name`,
  );
}
