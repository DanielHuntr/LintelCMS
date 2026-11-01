import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { hashPassword } from "../auth/passwords.js";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { ActiveDatabase } from "../database/active-database.js";
import { openBuiltInDatabase } from "../database/built-in-database.js";
import type { Database } from "../database/client.js";
import { assignRoleToUser, insertRole } from "../roles/roles.repository.js";
import { buildServer } from "../server.js";
import { startSession } from "../sessions/sessions.service.js";
import { insertUser } from "../users/users.repository.js";
import type { LintelPlugin } from "./plugin-definition.js";
import { setEnabledPlugins } from "./plugins.service.js";

/**
 * `@lintel/core/plugin-testing`: a real Lintel server for a plugin's tests, on a built-in
 * database held in memory, with the plugin installed and switched on.
 *
 *   const lintel = await startPluginTestServer({ plugins: [bookingsPlugin] });
 *   const asReceptionist = await lintel.signInWith(["bookings:read"]);
 *   const response = await asReceptionist({ method: "GET", url: "/bookings" });
 *   await lintel.close();
 *
 * Starting one takes a few seconds (the database is created from nothing), so start it
 * once per test file, in `beforeAll`.
 */

export interface PluginTestServerOptions {
  plugins: readonly LintelPlugin[];
  /** The plugins to switch on. Defaults to all of `plugins`. */
  enabled?: readonly string[];
}

/** Sends a request as one signed-in person. */
export type SignedInRequest = (options: InjectOptions) => Promise<LightMyRequestResponse>;

export interface PluginTestServer {
  server: FastifyInstance;
  database: Database;
  /** Makes a person whose one role has exactly these permissions, and signs them in. */
  signInWith: (permissions: readonly string[]) => Promise<SignedInRequest>;
  setEnabledPlugins: (pluginIds: readonly string[]) => Promise<void>;
  close: () => Promise<void>;
}

/** Test people never sign in with it, but every account needs a password. */
const TEST_PASSWORD = "a long and memorable password";

export async function startPluginTestServer(
  options: PluginTestServerOptions,
): Promise<PluginTestServer> {
  const opened = await openBuiltInDatabase();
  await opened.applyMigrations();
  const server = buildServer({
    adminOrigin: "http://localhost:5173",
    database: new ActiveDatabase(opened, "default"),
    runScheduledJobs: false,
    plugins: options.plugins,
  });
  await server.ready();
  const enable = (pluginIds: readonly string[]) =>
    setEnabledPlugins(opened.database, server.plugins, pluginIds).then(() => undefined);
  await enable(options.enabled ?? options.plugins.map((plugin) => plugin.id));

  let peopleMade = 0;
  return {
    server,
    database: opened.database,
    setEnabledPlugins: enable,
    signInWith: async (permissions) => {
      peopleMade += 1;
      const cookies = await makePerson(opened.database, peopleMade, permissions);
      return (request) => server.inject({ ...request, cookies });
    },
    close: async () => {
      await server.close();
      await opened.close();
    },
  };
}

async function makePerson(
  database: Database,
  number: number,
  permissions: readonly string[],
): Promise<Record<string, string>> {
  const email = `person-${number}@example.com`;
  const user = await insertUser(database, {
    email,
    name: `Test person ${number}`,
    passwordHash: await hashPassword(TEST_PASSWORD),
  });
  const role = await insertRole(database, {
    handle: `test-role-${number}`,
    name: `Test role ${number}`,
    permissions: [...permissions],
  });
  await assignRoleToUser(database, user.id, role.id);

  // Straight to a session rather than through /auth/sign-in, which allows only a few
  // attempts a minute.
  const session = await startSession(database, user.id, "plugin tests");
  return { [SESSION_COOKIE_NAME]: session.token };
}
