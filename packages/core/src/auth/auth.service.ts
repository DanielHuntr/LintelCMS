import type { Database } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findPermissionsForUser } from "../roles/roles.service.js";
import {
  endSession,
  findActiveSession,
  type StartedSession,
  startSession,
} from "../sessions/sessions.service.js";
import { findUserByEmail, findUserById, recordSignIn } from "../users/users.repository.js";
import type { User } from "../users/users.table.js";
import { SignInFailedError } from "./auth.errors.js";
import type { SignedIn, SignInRequest } from "./auth.schema.js";
import { hashPassword, verifyPassword } from "./passwords.js";

/**
 * Business rules for signing in and out. HTTP details (cookies, status codes) stay in
 * auth.routes.ts; database details stay in the repositories.
 */

export interface SignInResult {
  session: StartedSession;
  signedIn: SignedIn;
}

export interface SignedInSession {
  signedIn: SignedIn;
  /** True when the session's expiry was just pushed forward, so the cookie needs renewing. */
  sessionWasExtended: boolean;
  sessionExpiresAt: Date;
}

/**
 * When the email is unknown we still check the password against this throwaway hash.
 * Otherwise "unknown email" would answer noticeably faster than "wrong password",
 * and the response time alone would reveal who has an account.
 */
let throwawayHash: Promise<string> | undefined;
function getThrowawayHash(): Promise<string> {
  throwawayHash ??= hashPassword("this password is never used for anything");
  return throwawayHash;
}

export async function signIn(
  database: Database,
  request: SignInRequest,
  userAgent: string | undefined,
  now = new Date(),
): Promise<SignInResult> {
  const user = await findUserByEmail(database, DEFAULT_TENANT_ID, request.email);
  const passwordMatches = await verifyPassword(
    request.password,
    user?.passwordHash ?? (await getThrowawayHash()),
  );

  if (!user || !user.passwordHash || !passwordMatches) {
    throw new SignInFailedError();
  }

  const session = await startSession(database, user.id, userAgent, now);
  await recordSignIn(database, user.id, now);

  return { session, signedIn: await describeSignedIn(database, user) };
}

/** Who a session token belongs to, or undefined if the token is unknown or expired. */
export async function findSignedIn(
  database: Database,
  token: string,
  now = new Date(),
): Promise<SignedInSession | undefined> {
  const activeSession = await findActiveSession(database, token, now);
  if (!activeSession) {
    return undefined;
  }

  const user = await findUserById(database, activeSession.session.userId);
  if (!user) {
    return undefined;
  }

  return {
    signedIn: await describeSignedIn(database, user),
    sessionWasExtended: activeSession.wasExtended,
    sessionExpiresAt: activeSession.session.expiresAt,
  };
}

export async function signOut(database: Database, token: string): Promise<void> {
  await endSession(database, token);
}

async function describeSignedIn(database: Database, user: User): Promise<SignedIn> {
  return {
    user: { id: user.id, email: user.email, name: user.name },
    permissions: await findPermissionsForUser(database, user.id),
  };
}
