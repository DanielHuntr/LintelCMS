import type { FastifyInstance } from "fastify";
import { hashPassword } from "../auth/passwords.js";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import type { Database } from "../database/client.js";
import { assignRoleToUser, insertRole } from "../roles/roles.repository.js";
import { insertUser } from "../users/users.repository.js";

/** The password every test user has. */
export const TEST_PASSWORD = "a long and memorable password";

/** Creates a user whose roles grant exactly the given permission lists, one role per list. */
export async function createTestUser(
  database: Database,
  email: string,
  permissionLists: string[][],
) {
  const user = await insertUser(database, {
    email,
    name: "Ana Editor",
    passwordHash: await hashPassword(TEST_PASSWORD),
  });
  for (const [index, permissions] of permissionLists.entries()) {
    const role = await insertRole(database, {
      handle: `${email}-role-${index}`,
      name: `${email} role ${index}`,
      permissions,
    });
    await assignRoleToUser(database, user.id, role.id);
  }
  return user;
}

/** Signs in through the API and returns the cookies to send with later requests. */
export async function signInAndGetCookies(
  server: FastifyInstance,
  email: string,
): Promise<Record<string, string>> {
  const response = await server.inject({
    method: "POST",
    url: "/auth/sign-in",
    payload: { email, password: TEST_PASSWORD },
  });
  const sessionCookie = response.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    throw new Error(`Sign-in failed with ${response.statusCode}: ${response.body}`);
  }
  return { [SESSION_COOKIE_NAME]: sessionCookie.value };
}
