import type { FastifyInstance } from "fastify";
import { hashPassword } from "../auth/passwords.js";
import type { Database } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { assignRoleToUser, findRoleByHandle } from "../roles/roles.repository.js";
import { ensureBuiltInRoles } from "../roles/roles.service.js";
import { insertUser } from "../users/users.repository.js";
import { TEST_PASSWORD } from "./test-users.js";

/**
 * People with the built-in roles (Owner, Admin, Editor, Author, Viewer), for tests of the
 * Users screen and account security. Everyone has `TEST_PASSWORD`.
 */
export async function createPersonWithRole(
  database: Database,
  email: string,
  roleHandle: string,
  name = email.split("@")[0] ?? email,
) {
  await ensureBuiltInRoles(database);
  const role = await findRoleByHandle(database, DEFAULT_TENANT_ID, roleHandle);
  if (!role) {
    throw new Error(`There is no role with the handle ${roleHandle}.`);
  }
  const user = await insertUser(database, {
    email,
    name,
    passwordHash: await hashPassword(TEST_PASSWORD),
  });
  await assignRoleToUser(database, user.id, role.id);
  return { user, role };
}

/** The token from the newest email to an address (the part after `#token=` in its link). */
export function tokenFromLatestEmail(server: FastifyInstance, email: string): string {
  const message = server.emailOutbox?.latestTo(email);
  const token = message?.text.match(/#token=([\w-]+)/)?.[1];
  if (!token) {
    throw new Error(`No email with a link was sent to ${email}.`);
  }
  return token;
}
