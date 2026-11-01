import type { FastifyInstance } from "fastify";
import { loadConfig, loadProjectEnvFile } from "./config.js";
import { describeActiveDatabase } from "./database/active-database.js";
import { buildServer } from "./server.js";
import { isSetupNeeded } from "./setup/setup.service.js";
import { openConfiguredDatabase, PortInUseError, runWithFriendlyErrors } from "./startup.js";
import { buildSiteServer } from "./website/site-server.js";

/**
 * Starts the API server. Run with `pnpm dev` from the repository root.
 * The database's tables are created or updated on every start, before it listens.
 */
await runWithFriendlyErrors(async () => {
  loadProjectEnvFile();
  const config = loadConfig();
  const activeDatabase = await openConfiguredDatabase(config);
  say(describeActiveDatabase(activeDatabase));

  const siteUrl =
    config.SITE_PUBLIC_URL?.replace(/\/+$/, "") ?? `http://localhost:${config.SITE_PORT}`;
  const server = buildServer({
    adminOrigin: config.ADMIN_ORIGIN,
    database: activeDatabase,
    // Local development usually runs over plain HTTP, where Secure cookies wouldn't be sent.
    secureCookies: config.NODE_ENV !== "development",
    publicApiUrl: config.API_PUBLIC_URL ?? `http://localhost:${config.API_PORT}`,
    graphiql: config.NODE_ENV === "development",
    webhooks: { allowPrivateAddresses: config.WEBHOOKS_ALLOW_PRIVATE_ADDRESSES },
    website: { builtInSiteUrl: config.SITE_ENABLED ? siteUrl : null },
    logger: true,
  });
  server.addHook("onClose", () => activeDatabase.close());
  // The website reads through the API server, so it starts after it and closes first. Its
  // hook is added before the API listens, because Fastify takes no hooks once it has started.
  const site = config.SITE_ENABLED ? buildSiteServer({ api: server, logger: true }) : null;
  if (site) {
    server.addHook("preClose", () => site.close());
  }
  await listenOrExplain(server, config.API_PORT, "API_PORT");
  if (site) {
    await listenOrExplain(site, config.SITE_PORT, "SITE_PORT", () => server.close());
  }

  await sayWhatToDoNext(server, config.ADMIN_ORIGIN);
  if (config.SITE_ENABLED) {
    say(`Your website is at ${siteUrl}`);
  }
  closeCleanlyOnStop(server);
});

async function listenOrExplain(
  server: FastifyInstance,
  port: number,
  setting: string,
  closeOthers: () => Promise<void> = async () => {},
): Promise<void> {
  try {
    await server.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    await server.close();
    await closeOthers();
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      throw new PortInUseError(port, setting);
    }
    throw error;
  }
}

async function sayWhatToDoNext(server: FastifyInstance, adminOrigin: string): Promise<void> {
  if (!(await isSetupNeeded(server.database))) {
    say(`Lintel's API is running. Open ${adminOrigin} to sign in.`);
    return;
  }

  say(`Lintel's API is running. Open ${adminOrigin} to finish setting up.`);
  say(`Setup code: ${server.setupCode} (needed only when setting up from another computer)`);
}

/**
 * Ctrl+C (and `tsx watch` restarting) should let the built-in database finish writing
 * and release its lock, rather than cutting it off mid-write.
 */
function closeCleanlyOnStop(server: FastifyInstance): void {
  const stop = async () => {
    await server.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

function say(message: string): void {
  process.stdout.write(`\n${message}\n`);
}
