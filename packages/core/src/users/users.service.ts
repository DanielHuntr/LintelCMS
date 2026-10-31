import { hashPassword } from "../auth/passwords.js";
import type { Database } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { assignRoleToUser, findRoleByHandle, insertRole } from "../roles/roles.repository.js";
import { findUserByEmail, insertUser } from "./users.repository.js";
import type { PublicUser } from "./users.schema.js";

/** The role every first admin gets. It can do everything. */
export const SUPER_ADMIN_ROLE = { handle: "super-admin", name: "Super admin", permissions: ["*"] };

export class EmailAlreadyUsedError extends Error {
  constructor(email: string) {
    super(`There is already a user with the email ${email}.`);
    this.name = "EmailAlreadyUsedError";
  }
}

export interface NewAdmin {
  email: string;
  name: string;
  password: string;
}

/**
 * Creates a user with the Super admin role, creating that role first if this is a fresh
 * install. Used by `pnpm --filter @lintel/core create-admin`. Expects the email and
 * password to have been checked with users.schema.ts already.
 */
export async function createAdmin(database: Database, admin: NewAdmin): Promise<PublicUser> {
  const passwordHash = await hashPassword(admin.password);

  return database.transaction(async (transaction) => {
    const existingUser = await findUserByEmail(transaction, DEFAULT_TENANT_ID, admin.email);
    if (existingUser) {
      throw new EmailAlreadyUsedError(admin.email);
    }

    const role =
      (await findRoleByHandle(transaction, DEFAULT_TENANT_ID, SUPER_ADMIN_ROLE.handle)) ??
      (await insertRole(transaction, SUPER_ADMIN_ROLE));
    const user = await insertUser(transaction, {
      email: admin.email,
      name: admin.name,
      passwordHash,
    });
    await assignRoleToUser(transaction, user.id, role.id);

    return { id: user.id, email: user.email, name: user.name };
  });
}
