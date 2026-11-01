import QRCode from "qrcode";
import { verifyPassword } from "../auth/passwords.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { roleRequiresTwoFactor } from "../roles/roles.service.js";
import { findUserById } from "../users/users.repository.js";
import { generateRecoveryCodes, hashRecoveryCode } from "./recovery-codes.js";
import { generateTotpSecret, totpSetupUrl, verifyTotpCode } from "./totp.js";
import {
  InvalidTwoFactorCodeError,
  TwoFactorNotEnabledError,
  TwoFactorNotStartedError,
  TwoFactorRequiredByRoleError,
  WrongPasswordError,
} from "./two-factor.errors.js";
import {
  claimTotpStep,
  countUnusedRecoveryCodes,
  deleteRecoveryCodes,
  deleteTwoFactorRow,
  findEnabledTwoFactorUserIds,
  findTwoFactorRow,
  replaceRecoveryCodes,
  savePendingSecret,
  updateTwoFactorRow,
  useRecoveryCode,
} from "./two-factor.repository.js";
import type { TwoFactorStatus } from "./two-factor.schema.js";

/**
 * Two-factor authentication with an authenticator app, plus recovery codes.
 *
 * Setting up takes two steps, so nobody is locked out by a QR code that never reached
 * their phone: `startTwoFactorSetup` makes a key, and `confirmTwoFactorSetup` only turns it
 * on once a code from the app matches.
 */

const ISSUER = "Lintel";

export interface TwoFactorSetup {
  /** The key, for typing in by hand. */
  secret: string;
  otpauthUrl: string;
  /** The same address as a QR code, as an SVG document. */
  qrCodeSvg: string;
}

export async function describeTwoFactor(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<TwoFactorStatus> {
  const row = await findTwoFactorRow(database, userId);
  const enabled = Boolean(row?.enabledAt && row.secret);
  return {
    enabled,
    required: await roleRequiresTwoFactor(database, userId),
    recoveryCodesLeft: enabled ? await countUnusedRecoveryCodes(database, userId) : 0,
  };
}

export async function isTwoFactorEnabled(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<boolean> {
  const row = await findTwoFactorRow(database, userId);
  return Boolean(row?.enabledAt && row.secret);
}

export function findUserIdsWithTwoFactor(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<string[]> {
  return findEnabledTwoFactorUserIds(database, userIds);
}

export async function startTwoFactorSetup(
  database: DatabaseOrTransaction,
  user: { id: string; email: string },
): Promise<TwoFactorSetup> {
  const secret = generateTotpSecret();
  await savePendingSecret(database, user.id, secret);
  const otpauthUrl = totpSetupUrl(ISSUER, user.email, secret);
  const qrCodeSvg = await QRCode.toString(otpauthUrl, { type: "svg", margin: 1 });
  return { secret, otpauthUrl, qrCodeSvg };
}

/** Turns two-factor on and returns the recovery codes, which are shown this once. */
export async function confirmTwoFactorSetup(
  database: DatabaseOrTransaction,
  userId: string,
  code: string,
  now = new Date(),
): Promise<{ recoveryCodes: string[] }> {
  const row = await findTwoFactorRow(database, userId);
  if (!row?.pendingSecret) {
    throw new TwoFactorNotStartedError();
  }
  const step = verifyTotpCode(row.pendingSecret, code, now, null);
  if (step === undefined) {
    throw new InvalidTwoFactorCodeError();
  }

  const recoveryCodes = generateRecoveryCodes();
  await database.transaction(async (transaction) => {
    await updateTwoFactorRow(transaction, userId, {
      secret: row.pendingSecret,
      pendingSecret: null,
      enabledAt: now,
      lastUsedStep: step,
    });
    await replaceRecoveryCodes(transaction, userId, recoveryCodes.map(hashRecoveryCode));
  });
  return { recoveryCodes };
}

export async function disableTwoFactor(
  database: DatabaseOrTransaction,
  userId: string,
  password: string,
): Promise<void> {
  await checkPassword(database, userId, password);
  if (await roleRequiresTwoFactor(database, userId)) {
    throw new TwoFactorRequiredByRoleError();
  }
  await database.transaction(async (transaction) => {
    await deleteTwoFactorRow(transaction, userId);
    await deleteRecoveryCodes(transaction, userId);
  });
}

export async function regenerateRecoveryCodes(
  database: DatabaseOrTransaction,
  userId: string,
  password: string,
): Promise<{ recoveryCodes: string[] }> {
  await checkPassword(database, userId, password);
  if (!(await isTwoFactorEnabled(database, userId))) {
    throw new TwoFactorNotEnabledError();
  }
  const recoveryCodes = generateRecoveryCodes();
  await replaceRecoveryCodes(database, userId, recoveryCodes.map(hashRecoveryCode));
  return { recoveryCodes };
}

export interface SecondFactor {
  code?: string;
  recoveryCode?: string;
}

/**
 * Checks a code from the app or a recovery code, and uses it up. False when it doesn't
 * match, has been used, or two-factor isn't on.
 */
export async function verifySecondFactor(
  database: DatabaseOrTransaction,
  userId: string,
  factor: SecondFactor,
  now = new Date(),
): Promise<boolean> {
  const row = await findTwoFactorRow(database, userId);
  if (!row?.secret || !row.enabledAt) {
    return false;
  }
  if (factor.recoveryCode) {
    return useRecoveryCode(database, userId, hashRecoveryCode(factor.recoveryCode), now);
  }
  if (!factor.code) {
    return false;
  }
  const step = verifyTotpCode(row.secret, factor.code, now, row.lastUsedStep);
  return step !== undefined && claimTotpStep(database, userId, step, row.lastUsedStep);
}

/** Changes like turning two-factor off ask for the password again, in case a laptop was left open. */
export async function checkPassword(
  database: DatabaseOrTransaction,
  userId: string,
  password: string,
): Promise<void> {
  const user = await findUserById(database, userId);
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new WrongPasswordError();
  }
}
