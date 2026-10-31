import { eq } from "drizzle-orm";
import type { Database, DatabaseOrTransaction } from "../database/client.js";
import { type NewSession, type Session, sessionsTable } from "./sessions.table.js";

/**
 * Database reads and writes for sessions. No rules live here: deciding whether a
 * session is still valid, or when to extend it, is the service's job.
 */

export async function insertSession(database: Database, session: NewSession): Promise<Session> {
  const [inserted] = await database.insert(sessionsTable).values(session).returning();
  if (!inserted) {
    throw new Error("The database did not return the new session.");
  }
  return inserted;
}

export async function findSessionByTokenHash(
  database: Database,
  tokenHash: string,
): Promise<Session | undefined> {
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
  await database.update(sessionsTable).set(times).where(eq(sessionsTable.id, sessionId));
}

export async function deleteSessionById(database: Database, sessionId: string): Promise<void> {
  await database.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
}

export async function deleteSessionByTokenHash(
  database: Database,
  tokenHash: string,
): Promise<void> {
  await database.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash));
}

/** Returns how many sessions were ended, so a script can say so. */
export async function deleteSessionsForUser(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<number> {
  const deleted = await database
    .delete(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .returning({ id: sessionsTable.id });
  return deleted.length;
}
