import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { authRoutes } from "./auth/auth.routes.js";
import { blueprintsRoutes } from "./blueprints/blueprints.routes.js";
import { collectionsRoutes } from "./collections/collections.routes.js";
import type { ActiveDatabase } from "./database/active-database.js";
import type { Database } from "./database/client.js";
import { DEFAULT_LINTEL_FOLDER, type LintelFolder } from "./database/database-choice.js";
import { deliveryRoutes } from "./delivery/delivery.routes.js";
import { entriesRoutes } from "./entries/entries.routes.js";
import { findEntriesUsingAsset } from "./entries/entries.service.js";
import { revisionsRoutes } from "./entries/revisions.routes.js";
import { fieldtypesRoutes } from "./fieldtypes/fieldtypes.routes.js";
import type { AssetExists, AssetLookup } from "./fieldtypes/image-assets.js";
import { healthRoutes } from "./health/health.routes.js";
import { sendHttpErrorDetails } from "./http/http-errors.js";
import { type AssetUsageFinder, createAssetLookup } from "./media/asset-lookup.js";
import { LocalDiskStorage } from "./media/local-disk-storage.js";
import { mediaRoutes } from "./media/media.routes.js";
import type { StorageDriver } from "./media/storage-driver.js";
import { DEFAULT_TRANSFORM_CACHE_FOLDER } from "./media/transform-cache.js";
import { pluginsRoutes } from "./plugins/plugins.routes.js";
import { previewRoutes } from "./preview/preview.routes.js";
import { registerScheduledJobs } from "./scheduler/scheduled-jobs.js";
import { searchRoutes } from "./search/search.routes.js";
import { generateSetupCode } from "./setup/setup-code.js";
import { setupRoutes } from "./setup/setup.routes.js";
import { localesRoutes } from "./sites/locales.routes.js";
import { taxonomiesRoutes } from "./taxonomies/taxonomies.routes.js";
import { globalsRoutes } from "./globals/globals.routes.js";
import { navigationRoutes } from "./navigation/navigation.routes.js";
import { translationsRoutes } from "./entries/translations.routes.js";

declare module "fastify" {
  interface FastifyInstance {
    /**
     * The database every route and guard uses. Read it on each request rather than
     * keeping it: the setup screen can switch the server to another database.
     */
    database: Database;
    /** The database in use and how it was chosen; setup switches it. */
    activeDatabase: ActiveDatabase;
    /** Where the built-in database and the saved database choice live. */
    lintelFolder: LintelFolder;
    /** Needed to set up from another computer; printed in the terminal at start. */
    setupCode: string;
    /** Whether cookies are marked Secure (HTTPS only). Off only in development. */
    secureCookies: boolean;
    /** Checks that an image picked for an entry is in the media library. */
    assetExists: AssetExists;
    /** Expands image ids into images for the delivery API. */
    assetLookup: AssetLookup;
    /** The API's address as browsers reach it, for absolute URLs such as an asset's `url`. */
    publicApiUrl: string;
  }
}

/** Where uploaded files go and how media learns what uses them. Every part has a default. */
export interface MediaOptions {
  /** Defaults to local disk at `.lintel/uploads`. Tests pass a temporary folder. */
  storage?: StorageDriver;
  /** Resized images. Defaults to `.lintel/cache/media`. */
  transformCacheFolder?: string;
  /** Which entries use an asset, checked before it is deleted. */
  usageFinder?: AssetUsageFinder;
}

export interface ServerOptions {
  /** The admin app's address, allowed to call the API from the browser. */
  adminOrigin: string;
  /**
   * Passed in rather than created here, so tests can hand over a test database.
   * A Postgres connection opens on the first query, so routes like /health never touch it.
   */
  database: ActiveDatabase;
  /** Defaults to `.lintel` at the repository root. Tests pass a temporary folder. */
  lintelFolder?: LintelFolder;
  /** Defaults to a new random code. Tests pass a known one. */
  setupCode?: string;
  /** Mark cookies Secure. Turn off only for plain-HTTP local development. */
  secureCookies?: boolean;
  /** Turn request logging off in tests to keep output readable. */
  logger?: boolean;
  /**
   * Run timed jobs, such as publishing scheduled entries, from startup until the server
   * closes. On by default; tests that drive the jobs themselves turn it off.
   */
  runScheduledJobs?: boolean;
  /** How images are checked and expanded. Defaults to the media library. */
  assetExists?: AssetExists;
  assetLookup?: AssetLookup;
  /** The API's address as browsers reach it. Defaults to http://localhost:4000. */
  publicApiUrl?: string;
  media?: MediaOptions;
}

/**
 * Builds the API server without starting it. Tests call this directly and send
 * requests with `server.inject`; main.ts calls it and then starts listening.
 *
 * Every feature registers its routes here, in one visible list (no auto-discovery).
 */
export function buildServer(options: ServerOptions) {
  const server = Fastify({ logger: options.logger ?? false });
  const activeDatabase = options.database;

  server.decorate("database", { getter: () => activeDatabase.database });
  server.decorate("activeDatabase", activeDatabase);
  server.decorate("lintelFolder", options.lintelFolder ?? DEFAULT_LINTEL_FOLDER);
  server.decorate("setupCode", options.setupCode ?? generateSetupCode());
  server.decorate("secureCookies", options.secureCookies ?? true);
  server.decorate("publicApiUrl", options.publicApiUrl ?? "http://localhost:4000");
  // Image fields check and expand assets through the media library. The lookup reads
  // server.database on every call, so it follows setup switching databases.
  const mediaLibrary = createAssetLookup(server);
  server.decorate(
    "assetExists",
    options.assetExists ?? ((assetId) => mediaLibrary.assetExists(assetId)),
  );
  server.decorate("assetLookup", options.assetLookup ?? mediaLibrary);
  server.decorateRequest("signedIn", null);
  server.setErrorHandler(sendHttpErrorDetails);

  server.register(cors, {
    origin: options.adminOrigin,
    credentials: true,
    // The plugin's default is GET, HEAD and POST only; the admin also updates and deletes.
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  });
  server.register(cookie);
  // Off by default; routes that need a limit (like sign-in) set their own.
  server.register(rateLimit, { global: false });

  server.register(healthRoutes);
  server.register(authRoutes);
  server.register(setupRoutes);
  server.register(pluginsRoutes);
  server.register(fieldtypesRoutes);
  server.register(blueprintsRoutes);
  server.register(collectionsRoutes);
  server.register(entriesRoutes);
  server.register(revisionsRoutes);
  server.register(deliveryRoutes);
  server.register(localesRoutes);
  server.register(translationsRoutes);
  server.register(taxonomiesRoutes);
  server.register(globalsRoutes);
  server.register(navigationRoutes);
  server.register(previewRoutes);
  server.register(searchRoutes);

  if (options.runScheduledJobs ?? true) {
    registerScheduledJobs(server);
  }
  server.register(mediaRoutes, {
    storage: options.media?.storage ?? new LocalDiskStorage(),
    cacheFolder: options.media?.transformCacheFolder ?? DEFAULT_TRANSFORM_CACHE_FOLDER,
    // An asset still used by an entry can't be deleted.
    usageFinder: options.media?.usageFinder ?? {
      findEntriesUsingAsset: (assetId) => findEntriesUsingAsset(server.database, assetId),
    },
  });

  return server;
}
