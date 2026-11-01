import type { FastifyInstance } from "fastify";
import { type EmailSender, LoggingEmailSender } from "../email/email-sender.js";
import { startRepeatingJob, type RepeatingJob } from "../scheduler/repeating-job.js";
import { approvalsRoutes } from "./approvals/approvals.routes.js";
import { checkApprovedBeforePublishing } from "./approvals/content-approval.service.js";
import { reviewRequestedEvent } from "./approvals/review-events.js";
import { WorkflowEngine } from "./engine/workflow-engine.js";
import { startRunsForEvent, startScheduledRuns } from "./engine/workflow-triggers.js";
import { notificationsRoutes } from "./notifications/notifications.routes.js";
import { workflowsRoutes } from "./workflows.routes.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Runs workflows in the background (see src/workflows). */
    workflows: WorkflowEngine;
  }
}

export interface WorkflowOptions {
  /** How "Send an email" steps send. Defaults to writing each email to the server log. */
  email?: EmailSender;
  /** Work on runs as soon as they start. Defaults to `runScheduledJobs`; tests run them by hand. */
  runStraightAway?: boolean;
}

const ONE_MINUTE = 60_000;

/**
 * Everything automations add to the server, in one place: the engine, the event they
 * declare, their listener on the event bus, the publishing check for content approval,
 * their routes, and their timed job.
 */
export function registerWorkflows(
  server: FastifyInstance,
  options: WorkflowOptions & { runScheduledJobs: boolean; adminOrigin: string },
): void {
  const engine = new WorkflowEngine({
    services: {
      database: () => server.database,
      events: server.events,
      email:
        options.email ??
        new LoggingEmailSender((message, details) => server.log.info({ email: details }, message)),
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

  server.register(workflowsRoutes);
  server.register(approvalsRoutes);
  server.register(notificationsRoutes);

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
  });
  server.addHook("onClose", async () => {
    await job?.stop();
  });
}
