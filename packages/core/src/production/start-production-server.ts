import { readDeploymentOptions } from "../deployment-options.js";
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
import { DataFolderInUseError } from "../database/data-folder-lock.js";
import { lintelPaths, openConfiguredDatabase, PortInUseError } from "../startup.js";
import {
  checkDataFolderIsWritable,
  forgetSetupCode,
  readOrCreateSetupCode,
  setupCodeFile,
} from "./data-folder.js";
import { DEFAULT_ADMIN_BUILD_FOLDER } from "./admin-app.js";
import { closeGracefullyOnStop } from "./graceful-shutdown.js";
import { productionLoggerOptions } from "./logging.js";
import {
  API_PREFIX,
  DEFAULT_SITE_PORT,
  type ProductionAddresses,
  productionAddresses,
} from "./production.config.js";
import { buildProductionServer } from "./production-server.js";
import { placeholderPublicSite, type PublicSite } from "./public-site.js";
import { contentModelOptionsFromConfig } from "../content-model-sync/content-model-config.js";
import { loadInstalledPlugins } from "../plugins/installed-plugins.js";
import { loadSiteAddons } from "../addons/site-addons.js";
import { builtInPublicSite } from "../website/built-in-public-site.js";
import { updatesOptionsFromConfig } from "../updates/updates.config.js";

export interface PrepareOptions {
  /** The website at every other address. Defaults to the built-in website or a placeholder. */
  publicSite?: PublicSite | undefined;
  /**
   * How long to wait for another copy of Lintel to let go of the built-in database. Shared
   * hosts start the new copy while the old one is still stopping; elsewhere this is 0.
   */
  waitForDataFolderSeconds?: number;
}

export interface PreparedProductionServer {
  server: FastifyInstance;
  addresses: ProductionAddresses;
  /** Where uploads go, for the "Lintel is running" line. */
  storageDescription: ReturnType<typeof describeStorage>;
}

/**
 * `pnpm start` (and the Docker image): checks the settings and storage, brings the database
 * up to date, then serves the API, the admin and the website from one process, on one port.
 */
export async function startProductionServer(config: Config, publicSite?: PublicSite) {
  const prepared = await prepareProductionServer(config, { publicSite });
  const { server, addresses } = prepared;

  try {
    await server.listen({ port: addresses.port, host: config.HOST });
  } catch (error) {
    await server.close();
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      throw new PortInUseError(addresses.port);
    }
    throw error;
  }

  await announceRunning(prepared, config);
  closeGracefullyOnStop(server, { timeoutSeconds: config.SHUTDOWN_TIMEOUT_SECONDS });
  return server;
}

/**
 * Everything `pnpm start` does except listening, for hosts that hand Lintel its requests
 * themselves (Passenger, see src/hosting). The server is ready: its jobs have started.
 */
export async function prepareProductionServer(
  config: Config,
  options: PrepareOptions = {},
): Promise<PreparedProductionServer> {
  const paths = lintelPaths(config);
  const addresses = productionAddresses(config);
  checkDataFolderIsWritable(paths.root);
  if (config.SITE_PORT !== DEFAULT_SITE_PORT && process.env.SITE_PORT !== undefined) {
    console.warn(
      "SITE_PORT is only used by `pnpm dev`. In production the website shares Lintel's one " +
        `port (${addresses.port}) with the admin and the API.`,
    );
  }

  const storage = createConfiguredStorage(config, paths.uploadsFolder);
  // A wrong bucket or key is found now, with a plain message, not on the first upload.
  await storage.checkReachable();
  const activeDatabase = await openWaitingForDataFolder(
    config,
    options.waitForDataFolderSeconds ?? 0,
  );
  const installedPlugins = await loadInstalledPlugins();
  const addons = await loadSiteAddons(paths.root, installedPlugins);

  const server = buildProductionServer({
    adminOrigin: addresses.adminOrigin,
    database: activeDatabase,
    lintelFolder: paths.lintelFolder,
    setupCode: readOrCreateSetupCode(paths.root),
    // Cookies are HTTPS-only whenever the site is; config.ts refuses plain HTTP elsewhere
    // unless ALLOW_INSECURE_HTTP is set.
    secureCookies: addresses.publicUrl.startsWith("https://"),
    publicApiUrl: addresses.publicApiUrl,
    logger: productionLoggerOptions(config.LOG_LEVEL),
    trustProxy: config.TRUST_PROXY,
    cronSecret: config.CRON_SECRET,
    webhooks: { allowPrivateAddresses: config.WEBHOOKS_ALLOW_PRIVATE_ADDRESSES },
    media: {
      storage,
      transformCacheFolder: paths.transformCacheFolder,
      signedUrlSeconds: signedUrlSeconds(config),
    },
    email: createConfiguredEmailSender(config, paths.root),
    updates: updatesOptionsFromConfig(config),
    plugins: installedPlugins,
    addons,
    contentModel: contentModelOptionsFromConfig(config),
    // The built-in website is at the site's own address, beside the admin and the API.
    website: { builtInSiteUrl: config.SITE_ENABLED ? addresses.publicUrl : null },
    adminPath: config.ADMIN_PATH,
    adminBuildFolder: config.ADMIN_BUILD_FOLDER ?? DEFAULT_ADMIN_BUILD_FOLDER,
    adminApiUrl: config.API_PUBLIC_URL ?? API_PREFIX,
    publicSite:
      options.publicSite ?? (config.SITE_ENABLED ? builtInPublicSite : placeholderPublicSite),
    ...readDeploymentOptions(),
  });
  server.addHook("onClose", () => activeDatabase.close());
  await server.ready();
  return { server, addresses, storageDescription: describeStorage(storage, config) };
}

/** The "Lintel is running" log line, warnings about risky settings, and the setup hint. */
export async function announceRunning(
  { server, addresses, storageDescription }: PreparedProductionServer,
  config: Config,
): Promise<void> {
  server.log.info(
    {
      site: addresses.publicUrl,
      admin: addresses.adminUrl,
      api: addresses.publicApiUrl,
      database: describeActiveDatabase(server.activeDatabase),
      storage: storageDescription,
      email: server.email.description,
    },
    "Lintel is running",
  );
  warnAboutRiskySettings(server, config);
  await sayWhatToDoNext(server, addresses.adminUrl, lintelPaths(config).root);
}

async function openWaitingForDataFolder(config: Config, seconds: number) {
  const giveUpAt = Date.now() + seconds * 1000;
  for (;;) {
    try {
      return await openConfiguredDatabase(config);
    } catch (error) {
      if (!(error instanceof DataFolderInUseError) || Date.now() >= giveUpAt) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
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

async function sayWhatToDoNext(
  server: FastifyInstance,
  adminUrl: string,
  dataFolder: string,
): Promise<void> {
  if (await isSetupNeeded(server.database)) {
    server.log.info(
      { setupCode: server.setupCode, setupCodeFile: setupCodeFile(dataFolder) },
      `Open ${adminUrl} to finish setting up. You'll be asked for the setup code above ` +
        "(it is also in setup-code.txt in the data folder).",
    );
    return;
  }
  forgetSetupCode(dataFolder);
}
