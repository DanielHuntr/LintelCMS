import { hashPassword } from "../auth/passwords.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { OWNER_ROLE_HANDLE } from "../roles/built-in-roles.js";
import { assignRoleToUser, findRoleByHandle } from "../roles/roles.repository.js";
import { ensureBuiltInRoles } from "../roles/roles.service.js";
import { endAllSessionsForUser } from "../sessions/sessions.service.js";
import { findClosestEmail } from "./closest-email.js";
import {
  findUserByEmail,
  insertUser,
  listUserEmails,
  updatePasswordHash,
} from "./users.repository.js";
import type { PublicUser } from "./users.schema.js";

export class EmailAlreadyUsedError extends Error {
  constructor(email: string) {
    super(`There is already a user with the email ${email}.`);
    this.name = "EmailAlreadyUsedError";
  }
}

export class UserNotFoundError extends Error {
  readonly closestEmail: string | undefined;

  constructor(email: string, closestEmail: string | undefined) {
    const suggestion = closestEmail ? ` Did you mean ${closestEmail}?` : "";
    super(`There is no user with the email ${email}.${suggestion}`);
    this.name = "UserNotFoundError";
    this.closestEmail = closestEmail;
  }
}

export interface NewAdmin {
  email: string;
  name: string;
  password: string;
}

export interface PasswordReset {
  user: PublicUser;
  /** How many signed-in browsers were signed out. */
  endedSessions: number;
}

/**
 * Creates a user with the Owner role, creating the built-in roles first if this is a fresh
 * install. Used by first-run setup and by `pnpm create-admin`. Expects the email and
 * password to have been checked with users.schema.ts already.
 *
 * Accepts a transaction too, so setup can check "no users yet" and create the first one
 * as a single step.
 */
export async function createAdmin(
  database: DatabaseOrTransaction,
  admin: NewAdmin,
): Promise<PublicUser> {
  const passwordHash = await hashPassword(admin.password);

  return database.transaction(async (transaction) => {
    const existingUser = await findUserByEmail(transaction, DEFAULT_TENANT_ID, admin.email);
    if (existingUser) {
      throw new EmailAlreadyUsedError(admin.email);
    }

    await ensureBuiltInRoles(transaction);
    const role = await findRoleByHandle(transaction, DEFAULT_TENANT_ID, OWNER_ROLE_HANDLE);
    if (!role) {
      throw new Error("The Owner role could not be created.");
    }
    const user = await insertUser(transaction, {
      email: admin.email,
      name: admin.name,
      passwordHash,
    });
    await assignRoleToUser(transaction, user.id, role.id);

    return { id: user.id, email: user.email, name: user.name };
  });
}

/**
 * Gives a user a new password and signs them out everywhere, for an admin who is locked
 * out (`pnpm reset-password`). Expects the password to have been checked already.
 */
export async function resetPassword(
  database: DatabaseOrTransaction,
  email: string,
  newPassword: string,
): Promise<PasswordReset> {
  const user = await findUserByEmail(database, DEFAULT_TENANT_ID, email);
  if (!user) {
    const emails = await listUserEmails(database, DEFAULT_TENANT_ID);
    throw new UserNotFoundError(email, findClosestEmail(email, emails));
  }

  const passwordHash = await hashPassword(newPassword);
  const endedSessions = await database.transaction(async (transaction) => {
    await updatePasswordHash(transaction, user.id, passwordHash);
    return endAllSessionsForUser(transaction, user.id);
  });

  return { user: { id: user.id, email: user.email, name: user.name }, endedSessions };
}
