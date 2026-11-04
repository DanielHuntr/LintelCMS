import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { hashPassword } from "../auth/passwords.js";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { emptyTables, withForeignKeysAtEase } from "../backups/database-snapshot.repository.js";
import { listSchemaTables } from "../backups/table-order.js";
import { ActiveDatabase } from "../database/active-database.js";
import { openBuiltInDatabase } from "../database/built-in-database.js";
import type { Database, OpenedDatabase } from "../database/client.js";
import { isMysqlUrl } from "../database/database-errors.js";
import { openMysqlDatabase } from "../database/dialect/mysql-database.js";
import { refusePostgresTablesOnMysql } from "../database/dialect/refuse-postgres-tables.js";
import { connectToPostgres } from "../database/postgres-database.js";
import { assignRoleToUser, insertRole } from "../roles/roles.repository.js";
import { buildServer } from "../server.js";
import { startSession } from "../sessions/sessions.service.js";
import { insertUser } from "../users/users.repository.js";
import { createLiquidEngine } from "../liquid-templates/liquid-engine.js";
import { createLintelGlobal } from "../liquid-templates/liquid-page-helpers.js";
import { findPluginCommand, runPluginCommand } from "./plugin-commands.js";
import { createPluginContext, pluginLog } from "./plugin-context.js";
import type { LintelPlugin } from "./plugin-definition.js";
import { isPluginEnabled, setEnabledPlugins } from "./plugins.service.js";

/**
 * `@lintel/core/plugin-testing`: a real Lintel server for a plugin's tests, with the plugin
 * installed and switched on. It uses a built-in database held in memory, or, when
 * TEST_DATABASE_URL names one, a Postgres, MySQL or MariaDB server. That database is emptied
 * first, so never point it at real data. On MySQL and MariaDB a query on a table that didn't
 * come through `tableFor` fails at once.
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
  /** Which kind of database this run is on. */
  databaseKind: OpenedDatabase["kind"];
  /** Makes a person whose one role has exactly these permissions, and signs them in. */
  signInWith: (permissions: readonly string[]) => Promise<SignedInRequest>;
  setEnabledPlugins: (pluginIds: readonly string[]) => Promise<void>;
  /** Runs one of a plugin's jobs now, as the scheduler would (only if the plugin is on). */
  runJob: (pluginId: string, jobId: string) => Promise<void>;
  /** Runs `lintel <plugin id>:<name> ...arguments`, and gives back what it said. */
  runCommand: (
    fullName: string,
    commandArguments?: readonly string[],
  ) => Promise<{ exitCode: number; output: string[] }>;
  /** Draws a Liquid template as a page would, with the plugins' tags and filters. */
  renderLiquid: (source: string, variables?: Record<string, unknown>) => Promise<string>;
  close: () => Promise<void>;
}

/** Test people never sign in with it, but every account needs a password. */
const TEST_PASSWORD = "a long and memorable password";

export async function startPluginTestServer(
  options: PluginTestServerOptions,
): Promise<PluginTestServer> {
  const opened = await openDatabaseForPluginTests();
  await opened.applyMigrations();
  if (opened.kind !== "built-in") await emptyDatabase(opened.database, listSchemaTables());
  const server = buildServer({
    adminOrigin: "http://localhost:5173",
    database: new ActiveDatabase(opened, "default"),
    runScheduledJobs: false,
    plugins: options.plugins,
  });
  await server.ready();
  if (opened.kind !== "built-in") {
    const ownTables = options.plugins.flatMap((plugin) => plugin.database?.tables ?? []);
    await emptyDatabase(opened.database, ownTables);
  }
  const enable = (pluginIds: readonly string[]) =>
    setEnabledPlugins(opened.database, server.plugins, pluginIds).then(() => undefined);
  await enable(options.enabled ?? options.plugins.map((plugin) => plugin.id));

  let peopleMade = 0;
  return {
    server,
    database: opened.database,
    databaseKind: opened.kind,
    setEnabledPlugins: enable,
    runJob: async (pluginId, jobId) => {
      const plugin = server.plugins.find(pluginId);
      const job = plugin?.jobs?.find(({ id }) => id === jobId);
      if (!plugin || !job) throw new Error(`There is no job "${jobId}" in "${pluginId}".`);
      if (!(await isPluginEnabled(opened.database, pluginId))) return;
      await job.run(createPluginContext(plugin, opened.database, pluginLog(plugin.id, server.log)));
    },
    runCommand: async (fullName, commandArguments = []) => {
      const found = findPluginCommand(server.plugins.plugins, fullName);
      if (!found) throw new Error(`There is no command "${fullName}".`);
      const output: string[] = [];
      const exitCode = await runPluginCommand(found.plugin, found.command, {
        arguments: commandArguments,
        database: opened.database,
        say: (text) => output.push(text),
      });
      return { exitCode, output };
    },
    renderLiquid: async (source, variables = {}) => {
      const folder = await mkdtemp(join(tmpdir(), "lintel-plugin-liquid-"));
      try {
        await mkdir(join(folder, "templates"));
        await writeFile(join(folder, "templates", "test.liquid"), source);
        const engine = createLiquidEngine(folder, { cache: false });
        const lintel = createLintelGlobal({
          menu: async () => [],
          form: async () => "",
          design: () => "",
          headMarker: "",
          header: "",
          footer: "",
          cookieSettings: "",
          database: opened.database,
        });
        return (await engine.renderFile(
          "test",
          {},
          { globals: { ...variables, lintel } },
        )) as string;
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
    },
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

async function openDatabaseForPluginTests(): Promise<OpenedDatabase> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return openBuiltInDatabase();
  if (!isMysqlUrl(url)) return connectToPostgres(url);
  refusePostgresTablesOnMysql();
  return openMysqlDatabase(url);
}

/** Test files on a database server share it, so each starts from nothing. */
async function emptyDatabase(database: Database, tables: Parameters<typeof emptyTables>[1]) {
  if (tables.length === 0) return;
  await database.transaction((transaction) =>
    withForeignKeysAtEase(transaction, () => emptyTables(transaction, tables)),
  );
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
