import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { checkIsActive, type SignInResult, startSignedInSession } from "../auth/auth.service.js";
import type { Database, DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  issueOneTimeToken,
  spendOneTimeToken,
} from "../one-time-tokens/one-time-tokens.service.js";
import type { OneTimeTokenPurpose } from "../one-time-tokens/one-time-tokens.table.js";
import type { RequestOrigin } from "../security-log/security-log.service.js";
import { findUserById } from "../users/users.repository.js";
import type { PublicUser } from "../users/users.schema.js";
import {
  PasskeyNotFoundError,
  PasskeyNotRecognisedError,
  PasskeyRegistrationFailedError,
} from "./passkeys.errors.js";
import {
  deletePasskeyRow,
  findPasskeyByCredentialId,
  insertPasskey,
  listPasskeyRows,
  recordPasskeyUse,
} from "./passkeys.repository.js";
import type { AddPasskeyRequest, PasskeyResponse } from "./passkeys.schema.js";
import type { PasskeyRow } from "./passkeys.table.js";

/**
 * Passkeys (WebAuthn), an optional way to sign in without a password. The WebAuthn
 * library does the cryptography; this file decides which challenges are valid and who a
 * passkey belongs to.
 *
 * Each ceremony starts with a random challenge, kept as a one-time token for five minutes,
 * and spent when the browser's answer comes back, so an answer can't be replayed.
 */

/** Which site passkeys belong to: the admin's address, as the browser sees it. */
export interface RelyingParty {
  id: string;
  name: string;
  origin: string;
}

const CHALLENGE_MILLISECONDS = 5 * 60 * 1000;

export function relyingPartyFor(adminOrigin: string): RelyingParty {
  return { id: new URL(adminOrigin).hostname, name: "Lintel", origin: adminOrigin };
}

export async function listPasskeys(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<PasskeyResponse[]> {
  return (await listPasskeyRows(database, userId)).map(describePasskey);
}

export async function startPasskeyRegistration(
  database: DatabaseOrTransaction,
  relyingParty: RelyingParty,
  user: PublicUser,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = await listPasskeyRows(database, user.id);
  const options = await generateRegistrationOptions({
    rpName: relyingParty.name,
    rpID: relyingParty.id,
    userName: user.email,
    userDisplayName: user.name,
    userID: new Uint8Array(Buffer.from(user.id.replace(/-/g, ""), "hex")),
    attestationType: "none",
    // The same authenticator can't be added twice.
    excludeCredentials: existing.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports,
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await rememberChallenge(database, "passkey-registration", options.challenge, user.id);
  return options;
}

export async function finishPasskeyRegistration(
  database: DatabaseOrTransaction,
  relyingParty: RelyingParty,
  user: PublicUser,
  request: AddPasskeyRequest,
  now = new Date(),
): Promise<PasskeyResponse> {
  const verification = await verifyRegistrationResponse({
    response: request.response,
    expectedChallenge: (challenge) =>
      spendChallenge(database, "passkey-registration", challenge, user.id, now),
    expectedOrigin: relyingParty.origin,
    expectedRPID: relyingParty.id,
    requireUserVerification: true,
  }).catch(() => ({ verified: false as const }));

  if (!verification.verified) {
    throw new PasskeyRegistrationFailedError();
  }
  const { credential } = verification.registrationInfo;
  if (await findPasskeyByCredentialId(database, credential.id)) {
    throw new PasskeyRegistrationFailedError();
  }

  const saved = await insertPasskey(database, {
    tenantId: DEFAULT_TENANT_ID,
    userId: user.id,
    name: request.name,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports ?? [],
  });
  return describePasskey(saved);
}

export async function removePasskey(
  database: DatabaseOrTransaction,
  userId: string,
  passkeyId: string,
): Promise<PasskeyRow> {
  const deleted = await deletePasskeyRow(database, userId, passkeyId);
  if (!deleted) {
    throw new PasskeyNotFoundError();
  }
  return deleted;
}

/** Sign-in doesn't know who is coming, so any of this site's passkeys may answer. */
export async function startPasskeySignIn(
  database: DatabaseOrTransaction,
  relyingParty: RelyingParty,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: relyingParty.id,
    userVerification: "required",
  });
  await rememberChallenge(database, "passkey-sign-in", options.challenge, null);
  return options;
}

/**
 * A passkey with user verification (a fingerprint, face or PIN on the device) proves two
 * things at once, so it signs in without a password or an app code.
 */
export async function finishPasskeySignIn(
  database: Database,
  relyingParty: RelyingParty,
  response: AuthenticationResponseJSON,
  origin: RequestOrigin,
  now = new Date(),
): Promise<SignInResult> {
  const passkey = await findPasskeyByCredentialId(database, response.id);
  const user = passkey ? await findUserById(database, passkey.userId) : undefined;
  if (!passkey || !user) {
    throw new PasskeyNotRecognisedError();
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: (challenge) =>
      spendChallenge(database, "passkey-sign-in", challenge, null, now),
    expectedOrigin: relyingParty.origin,
    expectedRPID: relyingParty.id,
    requireUserVerification: true,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
      counter: passkey.counter,
      transports: passkey.transports,
    },
  }).catch(() => ({ verified: false as const, authenticationInfo: undefined }));

  if (!verification.verified || !verification.authenticationInfo) {
    throw new PasskeyNotRecognisedError();
  }
  checkIsActive(user);
  await recordPasskeyUse(database, passkey.id, verification.authenticationInfo.newCounter, now);
  return startSignedInSession(database, user, origin.userAgent ?? undefined, now);
}

async function rememberChallenge(
  database: DatabaseOrTransaction,
  purpose: OneTimeTokenPurpose,
  challenge: string,
  userId: string | null,
): Promise<void> {
  await issueOneTimeToken(database, {
    purpose,
    userId,
    token: challenge,
    lifetimeMilliseconds: CHALLENGE_MILLISECONDS,
  });
}

async function spendChallenge(
  database: DatabaseOrTransaction,
  purpose: OneTimeTokenPurpose,
  challenge: string,
  userId: string | null,
  now: Date,
): Promise<boolean> {
  const spent = await spendOneTimeToken(database, purpose, challenge, now);
  return spent !== undefined && spent.userId === userId;
}

function describePasskey(row: PasskeyRow): PasskeyResponse {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}
