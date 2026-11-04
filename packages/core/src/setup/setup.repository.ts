import type { Transaction } from "../database/client.js";
import { holdLockUntilTransactionEnds } from "../database/dialect/locks.js";

/**
 * Any fixed number works, as long as nothing else in Lintel uses the same one.
 * It spells "LNTL" in ASCII.
 */
const SETUP_LOCK_KEY = 0x4c4e544c;

/**
 * Makes other setup transactions wait until this one ends, so two people pressing
 * "Create account" at the same moment can't both become the first admin. It also works
 * across several server processes.
 */
export async function lockSetup(transaction: Transaction): Promise<void> {
  await holdLockUntilTransactionEnds(transaction, SETUP_LOCK_KEY);
}
