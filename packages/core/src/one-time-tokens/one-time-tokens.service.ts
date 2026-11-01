import { randomBytes } from "node:crypto";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { hashSessionToken } from "../sessions/sessions.service.js";
import {
  countRecentOneTimeTokens,
  deleteOneTimeTokensForUser,
  findLatestUnusedOneTimeTokenForUser,
  findUnusedOneTimeToken,
  insertOneTimeToken,
  markOneTimeTokenUsed,
} from "./one-time-tokens.repository.js";
import type {
  OneTimeToken,
  OneTimeTokenDetails,
  OneTimeTokenPurpose,
} from "./one-time-tokens.table.js";

/**
 * Issuing and spending single-use tokens. Each is random (256 bits) and stored only as a
 * SHA-256 hash, the same way as session tokens.
 */

export interface NewOneTimeTokenRequest {
  purpose: OneTimeTokenPurpose;
  userId: string | null;
  lifetimeMilliseconds: number;
  details?: OneTimeTokenDetails;
  /** Passkey challenges are made by the WebAuthn library; everything else is made here. */
  token?: string;
}

export interface IssuedOneTimeToken {
  token: string;
  expiresAt: Date;
}

export function generateOneTimeTokenSecret(): string {
  return randomBytes(32).toString("base64url");
}

export async function issueOneTimeToken(
  database: DatabaseOrTransaction,
  request: NewOneTimeTokenRequest,
  now = new Date(),
): Promise<IssuedOneTimeToken> {
  const token = request.token ?? generateOneTimeTokenSecret();
  const expiresAt = new Date(now.getTime() + request.lifetimeMilliseconds);
  await insertOneTimeToken(database, {
    tenantId: DEFAULT_TENANT_ID,
    purpose: request.purpose,
    userId: request.userId,
    tokenHash: hashSessionToken(token),
    details: request.details ?? {},
    expiresAt,
    createdAt: now,
  });
  return { token, expiresAt };
}

/** The token if it is unused and unexpired, without spending it. */
export function findUsableOneTimeToken(
  database: DatabaseOrTransaction,
  purpose: OneTimeTokenPurpose,
  token: string,
  now = new Date(),
): Promise<OneTimeToken | undefined> {
  return findUnusedOneTimeToken(database, purpose, hashSessionToken(token), now);
}

/** Spends the token: it works this once, then never again. Undefined if it can't be used. */
export function spendOneTimeToken(
  database: DatabaseOrTransaction,
  purpose: OneTimeTokenPurpose,
  token: string,
  now = new Date(),
): Promise<OneTimeToken | undefined> {
  return markOneTimeTokenUsed(database, purpose, hashSessionToken(token), now);
}

export function cancelOneTimeTokens(
  database: DatabaseOrTransaction,
  userId: string,
  purpose: OneTimeTokenPurpose,
): Promise<void> {
  return deleteOneTimeTokensForUser(database, userId, purpose);
}

export function countOneTimeTokensSince(
  database: DatabaseOrTransaction,
  userId: string,
  purpose: OneTimeTokenPurpose,
  since: Date,
): Promise<number> {
  return countRecentOneTimeTokens(database, userId, purpose, since);
}

/** The newest token of this kind the user can still use, such as a pending email change. */
export function findLatestUsableOneTimeToken(
  database: DatabaseOrTransaction,
  userId: string,
  purpose: OneTimeTokenPurpose,
  now = new Date(),
): Promise<OneTimeToken | undefined> {
  return findLatestUnusedOneTimeTokenForUser(database, userId, purpose, now);
}
