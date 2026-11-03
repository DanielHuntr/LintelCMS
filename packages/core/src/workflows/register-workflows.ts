import type { FastifyInstance } from "fastify";
import { startRepeatingJob, type RepeatingJob } from "../scheduler/repeating-job.js";
import { checkApprovedBeforePublishing } from "./approvals/content-approval.service.js";
import { reviewRequestedEvent } from "./approvals/review-events.js";
import { WorkflowEngine } from "./engine/workflow-engine.js";
import { startRunsForEvent, startScheduledRuns } from "./engine/workflow-triggers.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Runs workflows in the background (see src/workflows). */
    workflows: WorkflowEngine;
  }
}

export interface WorkflowOptions {
  /** Work on runs as soon as they start. Defaults to `runScheduledJobs`; tests run them by hand. */
  runStraightAway?: boolean;
}

const ONE_MINUTE = 60_000;

/**
 * Everything automations add to the server besides their routes (which are the
 * Automations plugin's, see automations.plugin.ts), in one place: the engine, the event
 * they declare, their listener on the event bus, the publishing check for content approval,
 * and their timed job.
 */
export function registerWorkflows(
  server: FastifyInstance,
  options: WorkflowOptions & { runScheduledJobs: boolean; adminOrigin: string },
): void {
  const engine = new WorkflowEngine({
    services: {
      database: () => server.database,
      events: server.events,
      // "Send an email" steps go through the same sender as every other email (see src/email).
      email: server.email,
      sender: server.webhooks.sender,
      assetExists: (assetId) => server.assetExists(assetId),
      adminUrl: options.adminOrigin,
    },
    runStraightAway: options.runStraightAway ?? options.runScheduledJobs,
    onError: (error) => server.log.error(error, "Running workflows failed"),
  });
  server.decorate("workflows", engine);
  server.addHook("onClose", () => engine.finishRunning());

  server.events.declare(reviewRequestedEvent);
  server.events.onEvery("automations", async (event) => {
    if ((await startRunsForEvent(server.database, event)) > 0) {
      engine.runSoon();
    }
  });
  server.events.addCheck("entry.publishing", (question) =>
    checkApprovedBeforePublishing(server.database, question),
  );

  if (options.runScheduledJobs) {
    registerWorkflowJob(server, engine);
  }
}

/** Every minute: start scheduled workflows, then carry on waits, retries and new runs. */
function registerWorkflowJob(server: FastifyInstance, engine: WorkflowEngine): void {
  let job: RepeatingJob | undefined;
  server.addHook("onReady", async () => {
    job = startRepeatingJob({
      everyMilliseconds: ONE_MINUTE,
      run: async () => {
        await startScheduledRuns(server.database, new Date());
        await engine.runDue();
      },
      onError: (error) => server.log.error(error, "Running workflows failed"),
    });
    server.scheduledJobs.add("workflows", job);
  });
  server.addHook("onClose", async () => {
    await job?.stop();
  });
}
