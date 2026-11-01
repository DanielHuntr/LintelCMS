import type { FastifyInstance } from "fastify";
import { ContentModelManagedInCodeError } from "./content-model-sync.errors.js";
import { contentModelSyncRoutes } from "./content-model-sync.routes.js";
import { changesContentModel, mayChangeContentModel } from "./model-lock.js";
import { ModelEvents } from "./model-events.js";
import { type ContentModelOptions, ContentModelSync } from "./model-sync.service.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Keeps the content model folder and the database in step. Null when not set up. */
    contentModelSync: ContentModelSync | null;
    /** Tells open admin screens the content model changed. */
    contentModelEvents: ModelEvents;
  }
}

/**
 * Puts content model sync on the server, in two parts because production serves the API
 * under /api:
 *
 *   - `setUpContentModelSync` (on the root server): the sync itself, which starts when the
 *     server is ready and stops when it closes;
 *   - `registerContentModelSyncRoutes` (beside the API's routes): its routes, and two hooks
 *     on every API request. They are called from buildServer rather than registered as a
 *     plugin, since a plugin's hooks would only see its own routes:
 *       - schema changes are refused while the admin may not edit the model;
 *       - in development, a change made in the admin is written to the files straight after.
 */
export function setUpContentModelSync(
  server: FastifyInstance,
  options: ContentModelOptions | undefined,
): void {
  const events = new ModelEvents();
  const sync = options
    ? new ContentModelSync(options, () => server.database, events, {
        info: (message) => server.log.info(message),
        error: (error, message) => server.log.error(error, message),
      })
    : null;
  server.decorate("contentModelSync", sync);
  server.decorate("contentModelEvents", events);
  if (!sync) {
    return;
  }
  server.addHook("onReady", () => sync.start());
  server.addHook("onClose", async () => sync.stop());
}

export function registerContentModelSyncRoutes(api: FastifyInstance): void {
  api.register(contentModelSyncRoutes);
  const sync = api.contentModelSync;
  if (!sync) {
    return;
  }
  // The rules read addresses as the API's own ("/blueprints"), without the /api prefix.
  const withoutPrefix = <Request extends { url: string }>(request: Request): Request => ({
    ...request,
    url: request.url.startsWith(api.prefix)
      ? request.url.slice(api.prefix.length) || "/"
      : request.url,
  });

  api.addHook("preHandler", async (request) => {
    const asApi = withoutPrefix({ method: request.method, url: request.url, body: request.body });
    if (sync.isLocked() && changesContentModel(asApi)) {
      throw new ContentModelManagedInCodeError(sync.options.folderLabel);
    }
  });
  api.addHook("onResponse", async (request, reply) => {
    const asApi = withoutPrefix({ method: request.method, url: request.url, body: request.body });
    if (reply.statusCode < 400 && mayChangeContentModel(asApi)) {
      sync.requestSync();
    }
  });
}
