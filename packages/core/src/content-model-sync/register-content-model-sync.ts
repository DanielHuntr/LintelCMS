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
 * Puts content model sync on the server: its routes, and three hooks on every request,
 * which is why this is called from buildServer rather than registered as a plugin (a
 * plugin's hooks would only see its own routes).
 *
 *   - schema changes are refused while the admin may not edit the model;
 *   - in development, a change made in the admin is written to the files straight after;
 *   - the first sync runs when the server is ready, and watching stops when it closes.
 */
export function registerContentModelSync(
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
  server.register(contentModelSyncRoutes);
  if (!sync) {
    return;
  }

  server.addHook("preHandler", async (request) => {
    if (sync.isLocked() && changesContentModel(request)) {
      throw new ContentModelManagedInCodeError(sync.options.folderLabel);
    }
  });
  server.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode < 400 && mayChangeContentModel(request)) {
      sync.requestSync();
    }
  });
  server.addHook("onReady", () => sync.start());
  server.addHook("onClose", async () => sync.stop());
}
