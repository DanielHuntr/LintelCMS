import type { FastifyInstance } from "fastify";
import type { AssetUsageFinder, StorageDriver } from "../media/index.js";
import { startRepeatingJob, type RepeatingJob } from "../scheduler/repeating-job.js";
import type { FormsContext } from "./forms-context.js";
import { type TurnstileVerifier, verifyWithCloudflare } from "./spam-protection.js";
import { deleteExpiredSubmissions } from "./submissions.service.js";

declare module "fastify" {
  interface FastifyInstance {
    /** What the Forms plugin's routes need besides the request (see src/forms). */
    forms: FormsRuntime;
  }
}

export interface FormsRuntime {
  /** The database and media library, read afresh for each request. */
  context: () => FormsContext;
  verifyTurnstile: TurnstileVerifier;
}

export interface FormsOptions {
  /** Where the files people send are stored: the media library's storage. */
  storage: StorageDriver;
  cacheFolder: string;
  usageFinder: AssetUsageFinder;
  /** Deletes submissions past their form's retention every hour. Tests run it by hand. */
  runScheduledJobs: boolean;
  /** Defaults to asking Cloudflare. Tests hand in their own. */
  verifyTurnstile?: TurnstileVerifier | undefined;
}

const ONE_HOUR = 60 * 60_000;

/**
 * Everything forms add to the server besides their routes (which are the Forms plugin's,
 * see forms.plugin.ts): what the routes need, and the hourly job that deletes submissions
 * past their form's retention. Switching the plugin off deletes nothing.
 */
export function registerForms(server: FastifyInstance, options: FormsOptions): void {
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
  server.decorate("forms", {
    context,
    verifyTurnstile: options.verifyTurnstile ?? verifyWithCloudflare,
  });

  if (!options.runScheduledJobs) return;
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
    server.scheduledJobs.add("form-retention", job);
  });
  server.addHook("onClose", async () => job?.stop());
}
