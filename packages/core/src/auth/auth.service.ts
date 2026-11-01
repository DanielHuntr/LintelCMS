import type { Database, DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  findUsableOneTimeToken,
  issueOneTimeToken,
  spendOneTimeToken,
} from "../one-time-tokens/one-time-tokens.service.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { findPermissionsForUser, roleRequiresTwoFactor } from "../roles/roles.service.js";
import {
  countRecentEventsBy,
  recordSecurityEvent,
  type RequestOrigin,
} from "../security-log/security-log.service.js";
import { readSetting } from "../settings/settings.service.js";
import {
  endSession,
  findActiveSession,
  type StartedSession,
  startSession,
} from "../sessions/sessions.service.js";
import { InvalidTwoFactorCodeError } from "../two-factor/two-factor.errors.js";
import { isTwoFactorEnabled, verifySecondFactor } from "../two-factor/two-factor.service.js";
import { findUserByEmail, findUserById, recordSignIn } from "../users/users.repository.js";
import type { PublicUser } from "../users/users.schema.js";
import type { User } from "../users/users.table.js";
import { AccountDeactivatedError, SignInExpiredError, SignInFailedError } from "./auth.errors.js";
import type {
  SignedIn,
  SignInRequest,
  TwoFactorChallenge,
  TwoFactorSignInRequest,
} from "./auth.schema.js";
import { hashPassword, verifyPassword } from "./passwords.js";

/**
 * Business rules for signing in and out. HTTP details (cookies, status codes) stay in
 * auth.routes.ts; database details stay in the repositories.
 *
 * Signing in takes one step, or two with two-factor authentication on: a correct password
 * then gives a short-lived challenge token, which a code from the app (or a recovery
 * code) turns into a session.
 */

export interface SignInResult {
  session: StartedSession;
  signedIn: SignedIn;
}

export type SignInOutcome =
  ({ kind: "signed-in" } & SignInResult) | ({ kind: "two-factor-required" } & TwoFactorChallenge);

export interface SignedInSession {
  signedIn: SignedIn;
  /** True when the session's expiry was just pushed forward, so the cookie needs renewing. */
  sessionWasExtended: boolean;
  sessionExpiresAt: Date;
}

/** Long enough to find the phone and open the app. */
const TWO_FACTOR_CHALLENGE_MILLISECONDS = 10 * 60 * 1000;

/** Wrong codes allowed for one password sign-in before starting again. */
const MAX_CODE_ATTEMPTS = 5;

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
  origin: RequestOrigin,
  now = new Date(),
): Promise<SignInOutcome> {
  const user = await findUserByEmail(database, DEFAULT_TENANT_ID, request.email);
  const passwordMatches = await verifyPassword(
    request.password,
    user?.passwordHash ?? (await getThrowawayHash()),
  );

  if (!user || !user.passwordHash || !passwordMatches) {
    await recordSecurityEvent(database, {
      kind: "sign-in-failed",
      actor: { id: user?.id ?? null, email: request.email },
      origin,
      details: { reason: "wrong email or password" },
    });
    throw new SignInFailedError();
  }
  checkIsActive(user);

  if (await isTwoFactorEnabled(database, user.id)) {
    const challenge = await issueOneTimeToken(
      database,
      {
        purpose: "two-factor-sign-in",
        userId: user.id,
        lifetimeMilliseconds: TWO_FACTOR_CHALLENGE_MILLISECONDS,
      },
      now,
    );
    return {
      kind: "two-factor-required",
      twoFactorRequired: true,
      challengeToken: challenge.token,
    };
  }

  const result = await startSignedInSession(database, user, origin.userAgent ?? undefined, now);
  await recordSignInEvent(database, user, origin, "password");
  return { kind: "signed-in", ...result };
}

/** The second step: a code from the app, or a recovery code. */
export async function completeTwoFactorSignIn(
  database: Database,
  request: TwoFactorSignInRequest,
  origin: RequestOrigin,
  now = new Date(),
): Promise<SignInResult> {
  const challenge = await findUsableOneTimeToken(
    database,
    "two-factor-sign-in",
    request.challengeToken,
    now,
  );
  const user = challenge?.userId ? await findUserById(database, challenge.userId) : undefined;
  if (!challenge || !user) {
    throw new SignInExpiredError();
  }
  checkIsActive(user);

  const failures = await countRecentEventsBy(
    database,
    user.id,
    "two-factor-failed",
    challenge.createdAt,
  );
  if (failures >= MAX_CODE_ATTEMPTS) {
    await spendOneTimeToken(database, "two-factor-sign-in", request.challengeToken, now);
    throw new SignInExpiredError();
  }

  const factor = { code: request.code, recoveryCode: request.recoveryCode };
  if (!(await verifySecondFactor(database, user.id, factor, now))) {
    await recordSecurityEvent(database, {
      kind: "two-factor-failed",
      actor: { id: user.id, email: user.email },
      origin,
    });
    throw new InvalidTwoFactorCodeError();
  }
  if (!(await spendOneTimeToken(database, "two-factor-sign-in", request.challengeToken, now))) {
    throw new SignInExpiredError();
  }

  const result = await startSignedInSession(database, user, origin.userAgent ?? undefined, now);
  await recordSignInEvent(
    database,
    user,
    origin,
    request.recoveryCode ? "recovery code" : "password and code",
  );
  return result;
}

export function checkIsActive(user: User): void {
  if (user.status !== "active") {
    throw new AccountDeactivatedError();
  }
}

export async function recordSignInEvent(
  database: DatabaseOrTransaction,
  user: PublicUser,
  origin: RequestOrigin,
  method: string,
): Promise<void> {
  await recordSecurityEvent(database, {
    kind: "sign-in",
    actor: { id: user.id, email: user.email },
    origin,
    details: { method },
  });
}

/**
 * Starts a session for someone whose identity is already settled: after a password check,
 * or for the first admin right after setup creates them.
 */
export async function startSignedInSession(
  database: Database,
  user: PublicUser,
  userAgent: string | undefined,
  now = new Date(),
): Promise<SignInResult> {
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
  // Deactivating ends sessions too; this also covers a session that was mid-request.
  if (!user || user.status !== "active") {
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

export async function describeSignedIn(
  database: DatabaseOrTransaction,
  user: PublicUser,
): Promise<SignedIn> {
  const mustSetUpTwoFactor =
    (await roleRequiresTwoFactor(database, user.id)) &&
    !(await isTwoFactorEnabled(database, user.id));
  return {
    user: { id: user.id, email: user.email, name: user.name },
    permissions: await findPermissionsForUser(database, user.id),
    enabledPlugins: await findEnabledPluginIds(database),
    siteName: await readSetting(database, "siteName"),
    ...(mustSetUpTwoFactor ? { mustSetUpTwoFactor: true as const } : {}),
  };
}
