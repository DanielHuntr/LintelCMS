import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSignedIn, requirePermission, requireSignedIn } from "../auth/require-permission.js";
import { readSessionToken } from "../auth/session-cookie.js";
import { parseRequest } from "../http/http-errors.js";
import { AppNotFoundError, SessionTokenNeedsAdminError } from "./apps.errors.js";
import {
  appIdParamsSchema,
  installAppRequestSchema,
  previewAppRequestSchema,
} from "./apps.schema.js";
import {
  type AppInstallContext,
  findApp,
  installApp,
  issueSessionToken,
  listAppExtensions,
  listApps,
  previewApp,
  uninstallApp,
} from "./apps.service.js";

export interface AppsRoutesOptions {
  /** The admin's address: embedded pages are given it, and apps may not be hosted there. */
  adminOrigin: string;
}

/**
 * HTTP only. Installing and removing apps are site settings; using their pages is for
 * everyone signed in.
 *
 *   GET    /apps                     (settings:read)    -> { apps: [App] }
 *   POST   /apps/preview             (settings:update)  { manifestUrl } | { manifest } -> { manifest, manifestUrl, alreadyInstalled }
 *   POST   /apps                     (settings:update)  { manifestUrl | manifest, approvedScopes } -> 201 { app, clientSecret }
 *   GET    /apps/:id                 (settings:read)    -> App
 *   DELETE /apps/:id                 (settings:update)  -> 204
 *   GET    /apps/extensions          (signed in)        -> { apps: [AppExtensions] }
 *   POST   /apps/:id/session-token   (signed in, in the admin) -> { token, expiresAt }
 */
export async function appsRoutes(server: FastifyInstance, options: AppsRoutesOptions) {
  const read = { preHandler: requirePermission("settings:read") };
  const update = { preHandler: requirePermission("settings:update") };
  const context = (): AppInstallContext => ({
    sender: server.webhooks.sender,
    addresses: { adminOrigin: options.adminOrigin, publicApiUrl: server.publicApiUrl },
  });

  server.get("/apps", read, async () => listApps(server.database));

  server.post("/apps/preview", update, async (request) =>
    previewApp(server.database, parseRequest(previewAppRequestSchema, request.body), context()),
  );

  server.post("/apps", update, async (request, reply) => {
    const install = parseRequest(installAppRequestSchema, request.body);
    const { user } = getSignedIn(request);
    const installed = await installApp(server.database, install, user, context());
    // The secret is in this response only; make sure nothing in between keeps a copy.
    return reply.code(201).header("cache-control", "no-store").send(installed);
  });

  server.get("/apps/extensions", { preHandler: requireSignedIn }, async () =>
    listAppExtensions(server.database),
  );

  server.get("/apps/:id", read, async (request) => findApp(server.database, readAppId(request)));

  server.delete("/apps/:id", update, async (request, reply) => {
    await uninstallApp(server.database, readAppId(request));
    return reply.code(204).send();
  });

  server.post(
    "/apps/:id/session-token",
    { preHandler: requireSignedIn },
    async (request, reply) => {
      // An app calling with its own secret can't mint tokens that claim a person is looking.
      if (!readSessionToken(request)) {
        throw new SessionTokenNeedsAdminError();
      }
      const token = await issueSessionToken(
        server.database,
        readAppId(request),
        getSignedIn(request),
        context().addresses,
      );
      return reply.header("cache-control", "no-store").send(token);
    },
  );
}

function readAppId(request: FastifyRequest): string {
  const parsed = appIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new AppNotFoundError();
  }
  return parsed.data.id;
}
