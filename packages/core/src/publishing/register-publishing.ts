import type { FastifyInstance } from "fastify";
import { pullFromBridge } from "../bridge/bridge-pull.service.js";
import { targetUsesBridge } from "../bridge/bridge-publish.service.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { startRepeatingJob, type RepeatingJob } from "../scheduler/repeating-job.js";
import { startPublish } from "./publish-runs.service.js";
import { createPublishingContext, type PublishingOptions } from "./publishing-context.js";
import { listTargetRows } from "./publishing.repository.js";
import { readSecrets } from "./publishing.service.js";

export interface PublishingRegistration extends PublishingOptions {
  /** Collects forms and orders from published sites every few minutes. Off in tests. */
  runScheduledJobs: boolean;
  /** How long to wait after content changes before publishing automatically. */
  automaticDelayMilliseconds?: number;
}

const FIVE_MINUTES = 5 * 60_000;
const ONE_MINUTE = 60_000;

/** Content changes that can change what a published website shows. */
const publishingEvents = new Set([
  "entry.published",
  "entry.unpublished",
  "entry.deleted",
  "entry.moved",
  "asset.deleted",
]);

/**
 * Everything publishing adds to the server besides its routes: `server.publishing`,
 * publishing automatically a minute after content is published (scheduled publishing
 * included, since the scheduler announces the same events), and collecting form
 * submissions and orders from published sites every five minutes.
 */
export function registerPublishing(server: FastifyInstance, options: PublishingRegistration): void {
  const context = createPublishingContext(server, options);
  server.decorate("publishing", context);
  const delay = options.automaticDelayMilliseconds ?? ONE_MINUTE;
  const waiting = new Map<string, NodeJS.Timeout>();

  const publishLater = (targetId: string) => {
    clearTimeout(waiting.get(targetId));
    const timer = setTimeout(() => {
      waiting.delete(targetId);
      if (context.running.has(targetId)) {
        publishLater(targetId);
        return;
      }
      startPublish(context, targetId, { trigger: "automatic" }).catch((error: unknown) =>
        server.log.error(error, "Publishing automatically failed"),
      );
    }, delay);
    timer.unref();
    waiting.set(targetId, timer);
  };

  server.events.onEvery("automatic publishing", async (event) => {
    if (!publishingEvents.has(event.name)) return;
    const targets = await listTargetRows(server.database, DEFAULT_TENANT_ID);
    for (const target of targets) {
      if (target.publishAutomatically) publishLater(target.id);
    }
  });
  server.addHook("onClose", async () => {
    for (const timer of waiting.values()) clearTimeout(timer);
  });

  if (!options.runScheduledJobs) return;
  let job: RepeatingJob | undefined;
  server.addHook("onReady", async () => {
    job = startRepeatingJob({
      everyMilliseconds: FIVE_MINUTES,
      run: async () => {
        const targets = await listTargetRows(server.database, DEFAULT_TENANT_ID);
        for (const target of targets) {
          if (!targetUsesBridge(target) || !target.lastPublishedAt || !target.options.siteAddress)
            continue;
          const secret = readSecrets(context.secretBox(), target).bridgeSecret ?? "";
          await pullFromBridge(server, target, secret).catch((error: unknown) =>
            server.log.warn(
              `Collecting forms and orders from ${target.options.siteAddress ?? target.name} failed: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        }
      },
      onError: (error) => server.log.error(error, "Collecting from published websites failed"),
    });
  });
  server.addHook("onClose", async () => job?.stop());
}
