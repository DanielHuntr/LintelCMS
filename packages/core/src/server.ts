import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import compress from "@fastify/compress";
import Fastify, { type FastifyInstance, type FastifyServerOptions, LogController } from "fastify";
import { apiTokensRoutes } from "./api-tokens/api-tokens.routes.js";
import { authRoutes } from "./auth/auth.routes.js";
import { blueprintsRoutes } from "./blueprints/blueprints.routes.js";
import { brandingRoutes } from "./branding/branding.routes.js";
import type { DeploymentBranding } from "./branding/deployment-branding.js";
import { lintelBranding } from "./branding/branding.schema.js";
import { collectionsRoutes } from "./collections/collections.routes.js";
import type { CommerceOptions } from "./commerce/commerce.context.js";
import { registerCommerce } from "./commerce/register-commerce.js";
import type { ContentModelOptions } from "./content-model-sync/model-sync.service.js";
import {
  registerContentModelSyncRoutes,
  setUpContentModelSync,
} from "./content-model-sync/register-content-model-sync.js";
import type { ActiveDatabase } from "./database/active-database.js";
import type { Database } from "./database/client.js";
import { DEFAULT_LINTEL_FOLDER, type LintelFolder } from "./database/database-choice.js";
import { deliveryAccessRoutes } from "./delivery/delivery-access.routes.js";
import { deliveryRoutes } from "./delivery/delivery.routes.js";
import { entriesRoutes } from "./entries/entries.routes.js";
import { findEntriesUsingAsset } from "./entries/entries.service.js";
import { revisionsRoutes } from "./entries/revisions.routes.js";
import { fieldtypesRoutes } from "./fieldtypes/fieldtypes.routes.js";
import { registerForms } from "./forms/register-forms.js";
import type { TurnstileVerifier } from "./forms/spam-protection.js";
import { graphqlRoutes } from "./graphql/graphql.routes.js";
import type { AssetExists, AssetLookup } from "./fieldtypes/image-assets.js";
import { healthRoutes } from "./health/health.routes.js";
import { DEFAULT_EMAIL_FROM } from "./email/email.config.js";
import { type EmailSender, OutboxEmailDriver, createEmailSender } from "./email/index.js";
import { interfaceLanguagesRoutes } from "./interface-languages/interface-languages.routes.js";
import { SOURCE_INTERFACE_LANGUAGE } from "./interface-languages/interface-languages.schema.js";
import { crossOriginOptions } from "./http/cross-origin.js";
import { refuseCrossSiteRequests } from "./http/cross-site-requests.js";
import { requestIdFor } from "./http/request-ids.js";
import { type TrustProxy, trustProxyOption } from "./production/production.config.js";
import { sendHttpErrorDetails } from "./http/http-errors.js";
import { describeRequestForLog } from "./http/request-logging.js";
import { addSecurityHeaders } from "./http/security-headers.js";
import { type AssetUsageFinder, createAssetLookup } from "./media/asset-lookup.js";
import { LocalDiskStorage } from "./media/local-disk-storage.js";
import { type MediaRoutesOptions, mediaRoutes } from "./media/media.routes.js";
import type { StorageDriver } from "./media/storage-driver.js";
import { DEFAULT_TRANSFORM_CACHE_FOLDER } from "./media/transform-cache.js";
import { openApiRoutes } from "./openapi/openapi.routes.js";
import { PluginCatalogue } from "./plugins/plugin-catalogue.js";
import type { LintelPlugin } from "./plugins/plugin-definition.js";
import { registerPluginRoutes } from "./plugins/plugin-routes.js";
import { pluginRegistry } from "./plugins/plugins.registry.js";
import { pagesRoutes } from "./pages/pages.routes.js";
import { pluginsRoutes } from "./plugins/plugins.routes.js";
import { previewRoutes } from "./preview/preview.routes.js";
import { registerScheduledJobs } from "./scheduler/scheduled-jobs.js";
import { searchRoutes } from "./search/search.routes.js";
import { dashboardRoutes } from "./dashboard/dashboard.routes.js";
import { generateSetupCode } from "./setup/setup-code.js";
import { setupRoutes } from "./setup/setup.routes.js";
import { siteAddressRoutes } from "./sites/site-address.routes.js";
import { localesRoutes } from "./sites/locales.routes.js";
import { sitesRoutes } from "./sites/sites.routes.js";
import { taxonomiesRoutes } from "./taxonomies/taxonomies.routes.js";
import { globalsRoutes } from "./globals/globals.routes.js";
import { navigationRoutes } from "./navigation/navigation.routes.js";
import { translationsRoutes } from "./entries/translations.routes.js";
import { WebhookDispatcher } from "./webhooks/webhook-dispatcher.js";
import { webhooksRoutes } from "./webhooks/webhooks.routes.js";
import { accountRoutes } from "./account/account.routes.js";
import { emailRoutes } from "./email/email.routes.js";
import { invitationsRoutes } from "./invitations/invitations.routes.js";
import { passkeysRoutes } from "./passkeys/passkeys.routes.js";
import { passwordResetRoutes } from "./password-reset/password-reset.routes.js";
import { rolesRoutes } from "./roles/roles.routes.js";
import { securityLogRoutes } from "./security-log/security-log.routes.js";
import { twoFactorRoutes } from "./two-factor/two-factor.routes.js";
import { usersRoutes } from "./users/users.routes.js";
import {
  clearRenderedPagesAfterChanges,
  createWebsiteRuntime,
  type WebsiteOptions,
  type WebsiteRuntime,
} from "./website/website-runtime.js";
import { starterSitesRoutes } from "./starter-sites/starter-sites.routes.js";
import { websiteRoutes } from "./website/website.routes.js";
import { EventBus } from "./events/event-bus.js";
import { subscribeEventListeners } from "./events/event-listeners.js";
import { registerWorkflows, type WorkflowOptions } from "./workflows/register-workflows.js";

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
    /** Sends queued webhook deliveries (see src/webhooks). */
    webhooks: WebhookDispatcher;
    /** The built-in plugins and the installed ones (see src/plugins). */
    plugins: PluginCatalogue;
    /** The admin app's address, for links in emails and as the passkeys' site. */
    adminOrigin: string;
    /** Sends email: `await server.email.send({ to, subject, text })` (see src/email). */
    email: EmailSender;
    /** The outbox, while no real email driver is set, for Settings → Email outbox. */
    emailOutbox: OutboxEmailDriver | null;
    /** The built-in website's templates, address and rendered pages (see src/website). */
    website: WebsiteRuntime;
    /** What happened, for features to react to (see src/events). */
    events: EventBus;
    /** The branding this server was deployed with (see src/branding). */
    deploymentBranding: DeploymentBranding;
    /** The admin's language this server was deployed with (see src/interface-languages). */
    defaultInterfaceLanguage: string;
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
  /** Send originals as redirects to signed storage links lasting this long (S3 only). */
  signedUrlSeconds?: number | undefined;
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
  /**
   * Turn request logging off in tests to keep output readable. Production passes pino
   * options instead (see src/production/logging.ts).
   */
  logger?: FastifyServerOptions["logger"];
  /** Compress responses (gzip, brotli) for browsers that accept it. Off by default. */
  compression?: boolean;
  /**
   * Where the API's routes live. Empty by default (development and tests); production
   * serves them under /api so the website can use every other address. `/health` and
   * `/ready` always stay at the root, where hosting platforms look for them.
   */
  apiPrefix?: string;
  /** How email is sent. Defaults to an outbox in memory, so nobody is emailed by accident. */
  email?: EmailSender;
  /**
   * Which proxies in front of the API to believe about the visitor's address (Fastify's
   * `trustProxy`): true for any, a number of hops, or a list of addresses. Off by default.
   * Behind nginx or Caddy, turn it on, or every visitor shares the proxy's address and one
   * person's failed sign-ins count against everyone's limit.
   */
  trustProxy?: TrustProxy;
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
  /** Serve GraphiQL, the in-browser GraphQL editor, at /graphql. Development only. */
  graphiql?: boolean;
  /** How webhooks are sent. Every part has a default. */
  webhooks?: WebhookOptions;
  /**
   * Plugins from packages, added after the built-in ones. main.ts loads them from
   * lintel.config.ts; tests pass the ones they test. Defaults to none.
   */
  plugins?: readonly LintelPlugin[];
  /** The built-in website: its address and any templates of your own. Off by default. */
  website?: WebsiteOptions;
  /** Content model as code (see src/content-model-sync). Off when left out, as in tests. */
  contentModel?: ContentModelOptions;
  /** How automations run and send email. Every part has a default. */
  workflows?: WorkflowOptions;
  /** Forms' Cloudflare Turnstile check. Defaults to asking Cloudflare; tests pass their own. */
  formsTurnstileVerifier?: TurnstileVerifier;
  /** How the online shop reaches payment services. Every part has a default. */
  commerce?: CommerceOptions;
  /** Branding from lintel.config.json and LINTEL_BRAND_*. Defaults to Lintel's own. */
  branding?: DeploymentBranding;
  /** The admin's language when the site hasn't chosen one. Defaults to English. */
  defaultInterfaceLanguage?: string;
}

export interface WebhookOptions {
  /**
   * Allow sending to localhost and private network addresses. Off by default, so
   * webhooks can't be pointed into the server's own network; for local testing only.
   */
  allowPrivateAddresses?: boolean;
  /** Send as soon as an event happens. Defaults to `runScheduledJobs`; tests send by hand. */
  sendStraightAway?: boolean;
}

/**
 * Builds the API server without starting it. Tests call this directly and send
 * requests with `server.inject`; main.ts calls it and then starts listening.
 *
 * Every feature registers its routes here, in one visible list (no auto-discovery).
 */
export function buildServer(options: ServerOptions) {
  const server = Fastify({
    logger: loggerWithSafeRequests(options.logger),
    trustProxy: trustProxyOption(options.trustProxy ?? false),
    genReqId: requestIdFor,
    logController: new LogController({
      requestIdLogLabel: "requestId",
      // Docker and uptime checks call it every few seconds; logging each would bury the rest.
      disableRequestLogging: (request) => request.url === "/health",
    }),
  });
  const activeDatabase = options.database;
  const apiPrefix = options.apiPrefix ?? "";
  const storage = options.media?.storage ?? new LocalDiskStorage();

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
  const webhooks = new WebhookDispatcher({
    database: () => server.database,
    sender: { allowPrivateAddresses: options.webhooks?.allowPrivateAddresses ?? false },
    sendStraightAway: options.webhooks?.sendStraightAway ?? options.runScheduledJobs ?? true,
    onError: (error) => server.log.error(error, "Sending webhooks failed"),
  });
  server.decorate("webhooks", webhooks);
  const plugins = new PluginCatalogue(pluginRegistry, options.plugins);
  server.decorate("plugins", plugins);
  // Plugins' own tables are brought up to date before the server takes requests.
  server.addHook("onReady", () => activeDatabase.applyPluginMigrations(plugins.migrations));
  server.decorate("adminOrigin", options.adminOrigin.replace(/\/+$/, ""));
  const email =
    options.email ??
    createEmailSender(new OutboxEmailDriver(), { defaultFrom: DEFAULT_EMAIL_FROM });
  server.decorate("email", email);
  server.decorate("emailOutbox", email.outbox);
  server.decorate("website", createWebsiteRuntime(options.website));
  clearRenderedPagesAfterChanges(server);
  server.decorate(
    "deploymentBranding",
    options.branding ?? { branding: lintelBranding, isCustomised: false },
  );
  server.decorate(
    "defaultInterfaceLanguage",
    options.defaultInterfaceLanguage ?? SOURCE_INTERFACE_LANGUAGE,
  );
  server.addHook("onClose", () => webhooks.finishSending());
  server.decorate(
    "events",
    new EventBus({
      onListenerError: (error, listenerName, event) =>
        server.log.error(error, `Telling ${listenerName} about ${event.name} failed`),
    }),
  );
  subscribeEventListeners(server);
  server.decorateRequest("signedIn", null);
  server.setErrorHandler(sendHttpErrorDetails);
  server.addHook("onSend", addSecurityHeaders(server.publicApiUrl));

  // Every response says which request it was, so a visitor's report can be found in the logs.
  server.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  if (options.compression) {
    server.register(compress, { global: true, threshold: 1024 });
  }
  // The admin may call everything; websites listed in Settings may call the content APIs.
  server.register(cors, { delegator: crossOriginOptions(options.adminOrigin, apiPrefix) });
  server.register(cookie);
  // Runs after cookies are read and before any route: see src/http/cross-site-requests.ts.
  server.addHook(
    "preValidation",
    refuseCrossSiteRequests([options.adminOrigin, server.publicApiUrl]),
  );
  // Off by default; routes that need a limit (like sign-in) set their own.
  server.register(rateLimit, { global: false });

  server.register(healthRoutes, { storage });
  setUpContentModelSync(server, options.contentModel);
  // The automations engine and its listeners; its routes are the Automations plugin's.
  registerWorkflows(server, {
    ...options.workflows,
    runScheduledJobs: options.runScheduledJobs ?? true,
    adminOrigin: options.adminOrigin,
  });
  const media: MediaRoutesOptions = {
    storage,
    signedUrlSeconds: options.media?.signedUrlSeconds,
    cacheFolder: options.media?.transformCacheFolder ?? DEFAULT_TRANSFORM_CACHE_FOLDER,
    // An asset still used by an entry can't be deleted.
    usageFinder: options.media?.usageFinder ?? {
      findEntriesUsingAsset: (assetId) => findEntriesUsingAsset(server.database, assetId),
    },
  };
  // What the Forms and Online shop plugins' routes need, and their timed jobs; their routes
  // are the plugins' own.
  registerForms(server, {
    ...media,
    runScheduledJobs: options.runScheduledJobs ?? true,
    verifyTurnstile: options.formsTurnstileVerifier,
  });
  registerCommerce(server, {
    ...options.commerce,
    // The Shopify importer saves product photos into the media library.
    media,
    runScheduledJobs: options.commerce?.runScheduledJobs ?? options.runScheduledJobs ?? true,
  });
  server.register(async (api) => registerApiRoutes(api, options, media), { prefix: apiPrefix });

  if (options.runScheduledJobs ?? true) {
    registerScheduledJobs(server);
  }

  return server;
}

/** Every feature's routes, in one visible list. */
function registerApiRoutes(
  server: FastifyInstance,
  options: ServerOptions,
  media: MediaRoutesOptions,
): void {
  // API answers are about one person or change often, so shared caches must not keep them
  // unless a route says otherwise (the delivery API and files do).
  server.addHook("onSend", async (_request, reply) => {
    if (!reply.hasHeader("cache-control")) {
      reply.header("cache-control", "no-store");
    }
  });

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
  server.register(sitesRoutes);
  server.register(translationsRoutes);
  server.register(taxonomiesRoutes);
  server.register(globalsRoutes);
  server.register(navigationRoutes);
  server.register(previewRoutes);
  server.register(searchRoutes);
  server.register(deliveryAccessRoutes);
  server.register(apiTokensRoutes);
  server.register(webhooksRoutes);
  server.register(graphqlRoutes, { graphiql: options.graphiql ?? false });
  server.register(openApiRoutes);
  server.register(siteAddressRoutes);
  server.register(dashboardRoutes);
  // Every plugin's routes, built in (SEO) and installed, each guarded for being switched on.
  registerPluginRoutes(server, server.plugins);
  // People and account security.
  server.register(usersRoutes);
  server.register(rolesRoutes);
  server.register(invitationsRoutes);
  server.register(accountRoutes);
  server.register(twoFactorRoutes);
  server.register(passkeysRoutes);
  server.register(passwordResetRoutes);
  server.register(securityLogRoutes);
  server.register(emailRoutes);
  server.register(brandingRoutes);
  server.register(interfaceLanguagesRoutes);
  server.register(websiteRoutes);
  server.register(pagesRoutes);
  server.register(starterSitesRoutes);
  registerContentModelSyncRoutes(server);
  server.register(mediaRoutes, media);
}

/**
 * The log never records full URLs with secrets in their query (see src/http/request-logging.ts),
 * whether the logger is the plain one (`true`) or production's options.
 */
function loggerWithSafeRequests(
  logger: FastifyServerOptions["logger"] | undefined,
): FastifyServerOptions["logger"] {
  if (!logger) return false;
  const base = logger === true ? {} : logger;
  return { ...base, serializers: { req: describeRequestForLog } };
}
