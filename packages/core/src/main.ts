import type { FastifyInstance } from "fastify";
import { loadConfig, loadProjectEnvFile } from "./config.js";
import { describeActiveDatabase } from "./database/active-database.js";
import { createConfiguredEmailSender } from "./email/index.js";
import { createConfiguredStorage, signedUrlSeconds } from "./media/configured-storage.js";
import { startProductionServer } from "./production/start-production-server.js";
import { buildServer } from "./server.js";
import { isSetupNeeded } from "./setup/setup.service.js";
import {
  lintelPaths,
  openConfiguredDatabase,
  PortInUseError,
  runWithFriendlyErrors,
} from "./startup.js";

/**
 * Starts Lintel. `pnpm dev` (NODE_ENV=development) starts only the API, beside the admin's
 * own development server. Anything else, such as `pnpm start`, serves the API, the built
 * admin and the website from this one process (see src/production).
 * The database's tables are created or updated on every start, before it listens.
 */
await runWithFriendlyErrors(async () => {
  loadProjectEnvFile();
  const config = loadConfig();
  if (config.NODE_ENV !== "development") {
    await startProductionServer(config);
    return;
  }

  const paths = lintelPaths(config);
  const activeDatabase = await openConfiguredDatabase(config);
  say(describeActiveDatabase(activeDatabase));

  const server = buildServer({
    adminOrigin: config.ADMIN_ORIGIN,
    database: activeDatabase,
    // Local development usually runs over plain HTTP, where Secure cookies wouldn't be sent.
    secureCookies: config.NODE_ENV !== "development",
    publicApiUrl: config.API_PUBLIC_URL ?? `http://localhost:${config.API_PORT}`,
    graphiql: config.NODE_ENV === "development",
    webhooks: { allowPrivateAddresses: config.WEBHOOKS_ALLOW_PRIVATE_ADDRESSES },
    lintelFolder: paths.lintelFolder,
    media: {
      storage: createConfiguredStorage(config, paths.uploadsFolder),
      transformCacheFolder: paths.transformCacheFolder,
      signedUrlSeconds: signedUrlSeconds(config),
    },
    email: createConfiguredEmailSender(config, paths.root),
    logger: true,
  });
  server.addHook("onClose", () => activeDatabase.close());

  try {
    await server.listen({ port: config.API_PORT, host: "0.0.0.0" });
  } catch (error) {
    await server.close();
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      throw new PortInUseError(config.API_PORT);
    }
    throw error;
  }

  await sayWhatToDoNext(server, config.ADMIN_ORIGIN);
  closeCleanlyOnStop(server);
});

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
