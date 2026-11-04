import { and, desc, eq, ne } from "drizzle-orm";
import type { Database, DatabaseOrTransaction } from "../database/client.js";
import {
  type NewSession,
  type Session,
  sessionsTable as sessionsDefinition,
} from "./sessions.table.js";
import { deleteReturning, insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/**
 * Database reads and writes for sessions. No rules live here: deciding whether a
 * session is still valid, or when to extend it, is the service's job.
 */

export async function insertSession(database: Database, session: NewSession): Promise<Session> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  const [inserted] = await insertReturning(database, sessionsTable, session);
  if (!inserted) {
    throw new Error("The database did not return the new session.");
  }
  return inserted;
}

export async function findSessionByTokenHash(
  database: Database,
  tokenHash: string,
): Promise<Session | undefined> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  const [session] = await database
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.tokenHash, tokenHash))
    .limit(1);
  return session;
}

export async function updateSessionExpiry(
  database: Database,
  sessionId: string,
  times: { lastUsedAt: Date; expiresAt: Date },
): Promise<void> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  await database.update(sessionsTable).set(times).where(eq(sessionsTable.id, sessionId));
}

export async function deleteSessionById(database: Database, sessionId: string): Promise<void> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  await database.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
}

export async function deleteSessionByTokenHash(
  database: Database,
  tokenHash: string,
): Promise<void> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  await database.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash));
}

/** Returns how many sessions were ended, so a script can say so. */
export async function deleteSessionsForUser(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<number> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  const deleted = await deleteReturning(database, sessionsTable, eq(sessionsTable.userId, userId), {
    id: sessionsTable.id,
  });
  return deleted.length;
}

export function listSessionsForUser(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<Session[]> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  return database
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .orderBy(desc(sessionsTable.lastUsedAt));
}

/** Only ends the user's own session. Returns whether there was one. */
export async function deleteSessionOfUser(
  database: DatabaseOrTransaction,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  const deleted = await deleteReturning(
    database,
    sessionsTable,
    and(eq(sessionsTable.userId, userId), eq(sessionsTable.id, sessionId)),
    { id: sessionsTable.id },
  );
  return deleted.length > 0;
}

export async function deleteOtherSessionsOfUser(
  database: DatabaseOrTransaction,
  userId: string,
  keepTokenHash: string,
): Promise<number> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  const deleted = await deleteReturning(
    database,
    sessionsTable,
    and(eq(sessionsTable.userId, userId), ne(sessionsTable.tokenHash, keepTokenHash)),
    { id: sessionsTable.id },
  );
  return deleted.length;
}
