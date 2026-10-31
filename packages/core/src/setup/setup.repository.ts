import { sql } from "drizzle-orm";
import type { Transaction } from "../database/client.js";

/**
 * Any fixed number works, as long as nothing else in Lintel uses the same one.
 * It spells "LNTL" in ASCII.
 */
const SETUP_LOCK_KEY = 0x4c4e544c;

/**
 * Makes other setup transactions wait until this one ends, so two people pressing
 * "Create account" at the same moment can't both become the first admin. It is a
 * Postgres advisory lock, so it also works across several server processes.
 */
export async function lockSetup(transaction: Transaction): Promise<void> {
  await transaction.execute(sql`select pg_advisory_xact_lock(${SETUP_LOCK_KEY})`);
}
