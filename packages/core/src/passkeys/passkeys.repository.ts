import { and, asc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type NewPasskeyRow,
  type PasskeyRow,
  passkeysTable as passkeysDefinition,
} from "./passkeys.table.js";
import { deleteReturning, insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for passkeys, nothing else. */

export async function insertPasskey(
  database: DatabaseOrTransaction,
  passkey: NewPasskeyRow,
): Promise<PasskeyRow> {
  const passkeysTable = tableFor(database, passkeysDefinition);
  const [inserted] = await insertReturning(database, passkeysTable, passkey);
  if (!inserted) {
    throw new Error("The database did not return the new passkey.");
  }
  return inserted;
}

export function listPasskeyRows(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<PasskeyRow[]> {
  const passkeysTable = tableFor(database, passkeysDefinition);
  return database
    .select()
    .from(passkeysTable)
    .where(eq(passkeysTable.userId, userId))
    .orderBy(asc(passkeysTable.createdAt));
}

export async function findPasskeyByCredentialId(
  database: DatabaseOrTransaction,
  credentialId: string,
): Promise<PasskeyRow | undefined> {
  const passkeysTable = tableFor(database, passkeysDefinition);
  const [passkey] = await database
    .select()
    .from(passkeysTable)
    .where(eq(passkeysTable.credentialId, credentialId))
    .limit(1);
  return passkey;
}

export async function recordPasskeyUse(
  database: DatabaseOrTransaction,
  passkeyId: string,
  counter: number,
  usedAt: Date,
): Promise<void> {
  const passkeysTable = tableFor(database, passkeysDefinition);
  await database
    .update(passkeysTable)
    .set({ counter, lastUsedAt: usedAt })
    .where(eq(passkeysTable.id, passkeyId));
}

/** Only deletes the user's own passkey. Returns the deleted row, if there was one. */
export async function deletePasskeyRow(
  database: DatabaseOrTransaction,
  userId: string,
  passkeyId: string,
): Promise<PasskeyRow | undefined> {
  const passkeysTable = tableFor(database, passkeysDefinition);
  const [deleted] = await deleteReturning(
    database,
    passkeysTable,
    and(eq(passkeysTable.id, passkeyId), eq(passkeysTable.userId, userId)),
  );
  return deleted;
}
