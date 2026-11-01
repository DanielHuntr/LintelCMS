import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import { describeActiveDatabase } from "../database/active-database.js";
import { createConfiguredEmailSender } from "../email/index.js";
import {
  createConfiguredStorage,
  describeStorage,
  signedUrlSeconds,
} from "../media/configured-storage.js";
import { isSetupNeeded } from "../setup/setup.service.js";
import { lintelPaths, openConfiguredDatabase, PortInUseError } from "../startup.js";
import { DEFAULT_ADMIN_BUILD_FOLDER } from "./admin-app.js";
import { closeGracefullyOnStop } from "./graceful-shutdown.js";
import { productionLoggerOptions } from "./logging.js";
import { API_PREFIX, productionAddresses, trustProxyOption } from "./production.config.js";
import { buildProductionServer } from "./production-server.js";
import type { PublicSite } from "./public-site.js";

/**
 * `pnpm start` (and the Docker image): checks the settings and storage, brings the database
 * up to date, then serves the API, the admin and the website from one process.
 */
export async function startProductionServer(config: Config, publicSite?: PublicSite) {
  const paths = lintelPaths(config);
  const addresses = productionAddresses(config);

  const storage = createConfiguredStorage(config, paths.uploadsFolder);
  // A wrong bucket or key is found now, with a plain message, not on the first upload.
  await storage.checkReachable();
  const activeDatabase = await openConfiguredDatabase(config);

  const server = buildProductionServer({
    adminOrigin: addresses.adminOrigin,
    database: activeDatabase,
    lintelFolder: paths.lintelFolder,
    // Cookies are HTTPS-only whenever the site is; config.ts refuses plain HTTP elsewhere
    // unless ALLOW_INSECURE_HTTP is set.
    secureCookies: addresses.publicUrl.startsWith("https://"),
    publicApiUrl: addresses.publicApiUrl,
    logger: productionLoggerOptions(config.LOG_LEVEL),
    trustProxy: trustProxyOption(config.TRUST_PROXY),
    webhooks: { allowPrivateAddresses: config.WEBHOOKS_ALLOW_PRIVATE_ADDRESSES },
    media: {
      storage,
      transformCacheFolder: paths.transformCacheFolder,
      signedUrlSeconds: signedUrlSeconds(config),
    },
    email: createConfiguredEmailSender(config, paths.root),
    adminPath: config.ADMIN_PATH,
    adminBuildFolder: config.ADMIN_BUILD_FOLDER ?? DEFAULT_ADMIN_BUILD_FOLDER,
    adminApiUrl: config.API_PUBLIC_URL ?? API_PREFIX,
    ...(publicSite ? { publicSite } : {}),
  });
  server.addHook("onClose", () => activeDatabase.close());

  try {
    await server.listen({ port: addresses.port, host: config.HOST });
  } catch (error) {
    await server.close();
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      throw new PortInUseError(addresses.port);
    }
    throw error;
  }

  server.log.info(
    {
      site: addresses.publicUrl,
      admin: addresses.adminUrl,
      api: addresses.publicApiUrl,
      database: describeActiveDatabase(activeDatabase),
      storage: describeStorage(storage, config),
      email: server.email.description,
    },
    "Lintel is running",
  );
  warnAboutRiskySettings(server, config);
  await sayWhatToDoNext(server, addresses.adminUrl);
  closeGracefullyOnStop(server, { timeoutSeconds: config.SHUTDOWN_TIMEOUT_SECONDS });
  return server;
}

function warnAboutRiskySettings(server: FastifyInstance, config: Config): void {
  if (!config.PUBLIC_URL) {
    server.log.warn(
      "PUBLIC_URL isn't set, so links to uploaded files point at localhost. Set it to the " +
        "site's address, such as https://example.com.",
    );
  }
  if (server.email.keepsInOutbox) {
    server.log.warn(
      "Emails are kept in the outbox folder, not sent. Set EMAIL_DRIVER to send them " +
        "(see the environment variables guide).",
    );
  }
  if (config.ALLOW_INSECURE_HTTP) {
    server.log.warn(
      "ALLOW_INSECURE_HTTP is on: passwords and sign-in cookies travel unencrypted. Use it " +
        "only on a test server.",
    );
  }
}

async function sayWhatToDoNext(server: FastifyInstance, adminUrl: string): Promise<void> {
  if (await isSetupNeeded(server.database)) {
    server.log.info(
      { setupCode: server.setupCode },
      `Open ${adminUrl} to finish setting up. You'll be asked for the setup code above.`,
    );
  }
}
