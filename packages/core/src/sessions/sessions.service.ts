import { createHash, randomBytes } from "node:crypto";
import type { Database, DatabaseOrTransaction } from "../database/client.js";
import {
  deleteOtherSessionsOfUser,
  deleteSessionById,
  deleteSessionOfUser,
  deleteSessionByTokenHash,
  deleteSessionsForUser,
  findSessionByTokenHash,
  insertSession,
  listSessionsForUser,
  updateSessionExpiry,
} from "./sessions.repository.js";
import type { Session } from "./sessions.table.js";

/** How long a session lasts without being used. */
export const SESSION_LIFETIME_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

/**
 * How often a session's expiry is pushed forward. Extending on every request would mean
 * a database write per request; once a day is plenty for a 30-day lifetime.
 */
const SESSION_REFRESH_INTERVAL_MILLISECONDS = 24 * 60 * 60 * 1000;

// Long enough that guessing one is hopeless (256 bits).
const TOKEN_BYTES = 32;

// Browsers can send very long user-agent strings; we only keep it for display.
const MAX_USER_AGENT_LENGTH = 500;

export interface StartedSession {
  /** The secret to put in the browser's cookie. It is never stored. */
  token: string;
  expiresAt: Date;
}

export interface ActiveSession {
  session: Session;
  /** True when the expiry was just pushed forward, so the cookie should be renewed too. */
  wasExtended: boolean;
}

/**
 * The token is random, so a plain SHA-256 is enough: there is nothing to brute-force,
 * unlike a password. Hashing just means a copy of the database can't be used to sign in.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function startSession(
  database: Database,
  userId: string,
  userAgent: string | undefined,
  now = new Date(),
): Promise<StartedSession> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MILLISECONDS);

  await insertSession(database, {
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    lastUsedAt: now,
    userAgent: userAgent?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
  });

  return { token, expiresAt };
}

/**
 * Finds the session for a cookie token, or undefined if it doesn't exist or has expired.
 * Expired sessions are deleted as they are found, so they don't pile up.
 */
export async function findActiveSession(
  database: Database,
  token: string,
  now = new Date(),
): Promise<ActiveSession | undefined> {
  const session = await findSessionByTokenHash(database, hashSessionToken(token));
  if (!session) {
    return undefined;
  }

  if (session.expiresAt.getTime() <= now.getTime()) {
    await deleteSessionById(database, session.id);
    return undefined;
  }

  const timeSinceLastExtended = now.getTime() - session.lastUsedAt.getTime();
  if (timeSinceLastExtended < SESSION_REFRESH_INTERVAL_MILLISECONDS) {
    return { session, wasExtended: false };
  }

  const extendedTimes = {
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MILLISECONDS),
  };
  await updateSessionExpiry(database, session.id, extendedTimes);
  return { session: { ...session, ...extendedTimes }, wasExtended: true };
}

export async function endSession(database: Database, token: string): Promise<void> {
  await deleteSessionByTokenHash(database, hashSessionToken(token));
}

/**
 * Signs a user out everywhere at once, for example after their password is reset, so
 * anyone who knew the old password loses access straight away.
 */
export function endAllSessionsForUser(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<number> {
  return deleteSessionsForUser(database, userId);
}

export function listUserSessions(database: DatabaseOrTransaction, userId: string) {
  return listSessionsForUser(database, userId);
}

export function endUserSession(
  database: DatabaseOrTransaction,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  return deleteSessionOfUser(database, userId, sessionId);
}

/** "Sign out other devices": every session but the one making the request. */
export function endOtherSessions(
  database: DatabaseOrTransaction,
  userId: string,
  currentToken: string,
): Promise<number> {
  return deleteOtherSessionsOfUser(database, userId, hashSessionToken(currentToken));
}
