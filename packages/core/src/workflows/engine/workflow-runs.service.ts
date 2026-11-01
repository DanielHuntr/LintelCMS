import type { SignedIn } from "../../auth/auth.schema.js";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { EventBus } from "../../events/event-bus.js";
import {
  ManualRunNotAllowedError,
  RunNotStoppableError,
  WorkflowRunNotFoundError,
  WorkflowSwitchedOffError,
} from "../workflows.errors.js";
import type {
  RunDetailResponse,
  RunSummaryResponse,
  RunWorkflowRequest,
} from "../workflows.schema.js";
import { findWorkflowOrFail } from "../workflows.service.js";
import type { WorkflowRunRow } from "../workflows.table.js";
import { buildSampleContext, describeActor } from "./run-context.js";
import { startWorkflowRun } from "./start-runs.js";
import {
  cancelRunRow,
  findRunRow,
  listRunRows,
  listStepLogRows,
} from "./workflow-runs.repository.js";

/** Starting runs by hand, the run history and stopping a run. */

/**
 * A test run uses sample data (the trigger event's, unless some is sent) and changes
 * nothing on the site. A real run by hand is for workflows started with a button or on a
 * schedule; ones started by events only run when the event happens.
 */
export async function startRunByHand(
  database: DatabaseOrTransaction,
  events: EventBus,
  workflowId: string,
  request: RunWorkflowRequest,
  signedIn: SignedIn,
  now = new Date(),
): Promise<RunSummaryResponse> {
  const workflow = await findWorkflowOrFail(database, workflowId);
  const { user } = signedIn;
  const actor = { id: user.id, name: user.name, email: user.email };
  if (request.test) {
    const eventName =
      workflow.trigger.type === "event" ? workflow.trigger.event : workflow.trigger.type;
    const sample = request.sampleData ?? events.findDefinition(eventName)?.sampleData ?? {};
    const context = await buildSampleContext(database, eventName, sample, actor, now);
    const { run } = await startWorkflowRun(database, workflow, {
      context,
      idempotencyKey: request.idempotencyKey ? `test:${request.idempotencyKey}` : null,
      isTest: true,
      startedBy: user.id,
      now,
    });
    return describeRunSummary(run);
  }
  if (workflow.trigger.type === "event") {
    throw new ManualRunNotAllowedError();
  }
  if (!workflow.enabled) {
    throw new WorkflowSwitchedOffError();
  }
  const { run } = await startWorkflowRun(database, workflow, {
    context: {
      ...request.data,
      event: { id: null, name: "manual", occurredAt: now.toISOString() },
      actor: await describeActor(database, actor),
    },
    idempotencyKey: request.idempotencyKey ? `manual:${request.idempotencyKey}` : null,
    startedBy: user.id,
    now,
  });
  return describeRunSummary(run);
}

export async function listRuns(
  database: DatabaseOrTransaction,
  workflowId: string,
  page: { page: number; perPage: number },
): Promise<{ runs: RunSummaryResponse[]; total: number }> {
  await findWorkflowOrFail(database, workflowId);
  const { rows, total } = await listRunRows(database, DEFAULT_TENANT_ID, workflowId, {
    limit: page.perPage,
    offset: (page.page - 1) * page.perPage,
  });
  return { runs: rows.map(describeRunSummary), total };
}

export async function findRunDetail(
  database: DatabaseOrTransaction,
  runId: string,
): Promise<RunDetailResponse> {
  const run = await findRunRow(database, DEFAULT_TENANT_ID, runId);
  if (!run) {
    throw new WorkflowRunNotFoundError();
  }
  const logs = await listStepLogRows(database, run.id);
  return {
    ...describeRunSummary(run),
    context: run.context,
    nextRunAt: run.nextRunAt?.toISOString() ?? null,
    logs: logs.map((log) => ({
      id: log.id,
      stepId: log.stepId,
      stepType: log.stepType,
      status: log.status,
      summary: log.summary,
      detail: log.detail,
      attempt: log.attempt,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function cancelRun(
  database: DatabaseOrTransaction,
  runId: string,
  now = new Date(),
): Promise<RunDetailResponse> {
  const run = await findRunRow(database, DEFAULT_TENANT_ID, runId);
  if (!run) {
    throw new WorkflowRunNotFoundError();
  }
  if (!(await cancelRunRow(database, run.id, now))) {
    throw new RunNotStoppableError();
  }
  return findRunDetail(database, run.id);
}

export function describeRunSummary(run: WorkflowRunRow): RunSummaryResponse {
  return {
    id: run.id,
    workflowId: run.workflowId,
    workflowName: run.workflowName,
    status: run.status,
    isTest: run.isTest,
    error: run.error,
    createdAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}
