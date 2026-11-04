import type { FastifyInstance } from "fastify";
import { hashPassword } from "../auth/passwords.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { sendBrandedEmail } from "../email/index.js";
import { assetFileUrl } from "../media/asset-response.js";
import { isImageMimeType } from "../media/file-types.js";
import { findAssetById } from "../media/media.repository.js";
import {
  cancelOneTimeTokens,
  findLatestUsableOneTimeToken,
  issueOneTimeToken,
  spendOneTimeToken,
} from "../one-time-tokens/one-time-tokens.service.js";
import { findRolesForUsers } from "../roles/roles.repository.js";
import { describeUserAgent } from "../sessions/describe-user-agent.js";
import {
  endOtherSessions,
  endUserSession,
  hashSessionToken,
  listUserSessions,
} from "../sessions/sessions.service.js";
import { checkPassword } from "../two-factor/two-factor.service.js";
import {
  AvatarNotFoundError,
  EmailAlreadyUsedHttpError,
  UserNotFoundHttpError,
} from "../users/users.errors.js";
import {
  findUserByEmail,
  findUserById,
  updatePasswordHash,
  updateUserRow,
} from "../users/users.repository.js";
import { requireStrongPassword } from "../users/users.service.js";
import type { User } from "../users/users.table.js";
import { EmailLinkInvalidError, SameEmailError, SessionNotFoundError } from "./account.errors.js";
import type {
  AccountResponse,
  AccountSession,
  ChangeEmailRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
} from "./account.schema.js";

/**
 * The signed-in person's own account: their name and picture, email, password and the
 * devices they're signed in on. Two-factor and passkeys have their own folders.
 */

/** A day: long enough to find the email, short enough not to linger. */
const EMAIL_CHANGE_MILLISECONDS = 24 * 60 * 60 * 1000;
const AVATAR_SIZE = 192;

export async function getAccount(
  server: FastifyInstance,
  userId: string,
): Promise<AccountResponse> {
  const database = server.database;
  const user = await findAccountUser(database, userId);
  const avatar = user.avatarAssetId
    ? await findAssetById(database, DEFAULT_TENANT_ID, user.avatarAssetId)
    : undefined;
  const pending = await findLatestUsableOneTimeToken(database, user.id, "email-change");
  const roles = await findRolesForUsers(database, [user.id]);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: avatar
      ? {
          id: avatar.id,
          url: assetFileUrl(server.publicApiUrl, avatar, {
            w: AVATAR_SIZE,
            h: AVATAR_SIZE,
            fit: "cover",
            format: "webp",
          }),
        }
      : null,
    pendingEmail: pending?.details.newEmail ?? null,
    roles: roles.map((role) => ({ id: role.id, name: role.name })),
  };
}

export async function updateProfile(
  server: FastifyInstance,
  userId: string,
  changes: UpdateProfileRequest,
): Promise<AccountResponse> {
  if (changes.avatarAssetId) {
    const asset = await findAssetById(server.database, DEFAULT_TENANT_ID, changes.avatarAssetId);
    if (!asset || !isImageMimeType(asset.mimeType)) {
      throw new AvatarNotFoundError();
    }
  }
  // Nothing to change (an empty form, say) is not an error: answer with the account as it is.
  if (changes.name !== undefined || changes.avatarAssetId !== undefined) {
    await updateUserRow(server.database, userId, {
      name: changes.name,
      avatarAssetId: changes.avatarAssetId,
    });
  }
  return getAccount(server, userId);
}

/**
 * Starts an email change. Nothing changes until the link sent to the new address is opened,
 * so a typo can't lock anyone out; the old address is told, in case it wasn't them.
 */
export async function requestEmailChange(
  server: FastifyInstance,
  userId: string,
  request: ChangeEmailRequest,
  now = new Date(),
): Promise<void> {
  const database = server.database;
  const user = await findAccountUser(database, userId);
  await checkPassword(database, user.id, request.password);
  if (request.newEmail === user.email) {
    throw new SameEmailError();
  }
  if (await findUserByEmail(database, DEFAULT_TENANT_ID, request.newEmail)) {
    throw new EmailAlreadyUsedHttpError(request.newEmail);
  }

  await cancelOneTimeTokens(database, user.id, "email-change");
  const { token } = await issueOneTimeToken(
    database,
    {
      purpose: "email-change",
      userId: user.id,
      lifetimeMilliseconds: EMAIL_CHANGE_MILLISECONDS,
      details: { newEmail: request.newEmail },
    },
    now,
  );
  sendBrandedEmail(server, request.newEmail, {
    subject: "Confirm your new email",
    heading: `Hello ${user.name},`,
    paragraphs: [
      "To start using this address for your account, confirm it within 24 hours.",
      "If you didn't ask for this, you can ignore this email.",
    ],
    action: {
      label: "Confirm this email",
      url: `${server.adminUrl}/confirm-email#token=${token}`,
    },
  });
  sendBrandedEmail(server, user.email, {
    subject: "Your email is changing",
    heading: `Hello ${user.name},`,
    paragraphs: [
      `Someone asked to change the email for your account to ${request.newEmail}. It changes once that address is confirmed.`,
      "If it wasn't you, change your password and tell an admin.",
    ],
  });
}

export async function confirmEmailChange(
  server: FastifyInstance,
  token: string,
  now = new Date(),
): Promise<{ user: User; previousEmail: string }> {
  return server.database.transaction(async (transaction) => {
    const spent = await spendOneTimeToken(transaction, "email-change", token, now);
    const newEmail = spent?.details.newEmail;
    const user = spent?.userId ? await findUserById(transaction, spent.userId) : undefined;
    if (!newEmail || !user || user.status !== "active") {
      throw new EmailLinkInvalidError();
    }
    if (await findUserByEmail(transaction, DEFAULT_TENANT_ID, newEmail)) {
      throw new EmailAlreadyUsedHttpError(newEmail);
    }
    const updated = await updateUserRow(transaction, user.id, { email: newEmail });
    return { user: updated ?? user, previousEmail: user.email };
  });
}

/** Changes the password and signs out every other device, keeping this one signed in. */
export async function changePassword(
  database: DatabaseOrTransaction,
  userId: string,
  currentSessionToken: string,
  request: ChangePasswordRequest,
): Promise<number> {
  await checkPassword(database, userId, request.currentPassword);
  const user = await findUserById(database, userId);
  if (user) {
    requireStrongPassword(request.newPassword, user.name, user.email);
  }
  const passwordHash = await hashPassword(request.newPassword);
  return database.transaction(async (transaction) => {
    await updatePasswordHash(transaction, userId, passwordHash);
    await cancelOneTimeTokens(transaction, userId, "password-reset");
    return endOtherSessions(transaction, userId, currentSessionToken);
  });
}

export async function listAccountSessions(
  database: DatabaseOrTransaction,
  userId: string,
  currentSessionToken: string | undefined,
): Promise<AccountSession[]> {
  const currentHash = currentSessionToken ? hashSessionToken(currentSessionToken) : undefined;
  const sessions = await listUserSessions(database, userId);
  return sessions.map((session) => ({
    id: session.id,
    browser: describeUserAgent(session.userAgent),
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: session.lastUsedAt.toISOString(),
    current: session.tokenHash === currentHash,
  }));
}

/** "Sign out other devices": every session but the one making the request. */
export function signOutOtherDevices(
  database: DatabaseOrTransaction,
  userId: string,
  currentSessionToken: string,
): Promise<number> {
  return endOtherSessions(database, userId, currentSessionToken);
}

export async function endAccountSession(
  database: DatabaseOrTransaction,
  userId: string,
  sessionId: string,
): Promise<void> {
  if (!(await endUserSession(database, userId, sessionId))) {
    throw new SessionNotFoundError();
  }
}

async function findAccountUser(database: DatabaseOrTransaction, userId: string): Promise<User> {
  const user = await findUserById(database, userId);
  if (!user) {
    throw new UserNotFoundHttpError();
  }
  return user;
}
