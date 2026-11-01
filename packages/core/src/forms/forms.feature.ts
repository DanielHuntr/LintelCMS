import type { FastifyInstance } from "fastify";
import type { AssetUsageFinder, StorageDriver } from "../media/index.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { startRepeatingJob, type RepeatingJob } from "../scheduler/repeating-job.js";
import type { FormsContext } from "./forms-context.js";
import { FormsSwitchedOffError } from "./forms.errors.js";
import { formsRoutes } from "./forms.routes.js";
import { publicFormsRoutes } from "./public-forms.routes.js";
import { type TurnstileVerifier, verifyWithCloudflare } from "./spam-protection.js";
import { submissionsRoutes } from "./submissions.routes.js";
import { deleteExpiredSubmissions } from "./submissions.service.js";

export interface FormsFeatureOptions {
  /** Where the files people send are stored: the media library's storage. */
  storage: StorageDriver;
  cacheFolder: string;
  usageFinder: AssetUsageFinder;
  /** For the "see it in Lintel" link in notification emails. */
  adminOrigin: string;
  /** Deletes submissions past their form's retention every hour. Tests run it by hand. */
  runScheduledJobs: boolean;
  /** Defaults to asking Cloudflare. Tests hand in their own. */
  verifyTurnstile?: TurnstileVerifier;
}

const ONE_HOUR = 60 * 60_000;

/**
 * Everything the Forms plugin adds to the API, registered from server.ts in one line. While
 * the plugin is switched off every forms address answers 404 FORMS_SWITCHED_OFF; the
 * forms and their submissions are kept, so switching it back on brings them all back.
 */
export async function formsFeature(server: FastifyInstance, options: FormsFeatureOptions) {
  const context = (): FormsContext => ({
    database: server.database,
    media: {
      database: server.database,
      storage: options.storage,
      cacheFolder: options.cacheFolder,
      publicApiUrl: server.publicApiUrl,
      usageFinder: options.usageFinder,
    },
  });

  // Registered in this plugin's own scope, so it guards only the forms routes below.
  server.addHook("onRequest", async (request) => {
    if (request.method === "OPTIONS") return;
    const enabled = await findEnabledPluginIds(server.database);
    if (!enabled.includes("forms")) {
      throw new FormsSwitchedOffError();
    }
  });

  await server.register(formsRoutes, { context });
  await server.register(submissionsRoutes, { context });
  await server.register(publicFormsRoutes, {
    context,
    verifyTurnstile: options.verifyTurnstile ?? verifyWithCloudflare,
    adminOrigin: options.adminOrigin,
  });

  if (options.runScheduledJobs) {
    let job: RepeatingJob | undefined;
    server.addHook("onReady", async () => {
      job = startRepeatingJob({
        everyMilliseconds: ONE_HOUR,
        run: async () => {
          const deleted = await deleteExpiredSubmissions(context());
          if (deleted > 0) {
            server.log.info({ deleted }, "Deleted form submissions past their retention");
          }
        },
        onError: (error) => server.log.error(error, "Deleting old form submissions failed"),
      });
    });
    server.addHook("onClose", async () => job?.stop());
  }
}
