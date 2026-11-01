import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { WorkflowRow, WorkflowRunRow } from "../workflows.table.js";
import { entryIdFromContext, type RunContext } from "./run-context.js";
import { findRunByIdempotencyKey, insertRunUnlessDuplicate } from "./workflow-runs.repository.js";

/**
 * How deep runs may lead to runs (a workflow calling another, or changing content that
 * starts another). Past this the run isn't started, so two workflows can't set each
 * other off forever.
 */
export const MAXIMUM_RUN_DEPTH = 5;

export interface StartRunOptions {
  context: RunContext;
  /** The same key never starts the same workflow twice: the existing run is returned. */
  idempotencyKey: string | null;
  isTest?: boolean;
  depth?: number;
  startedBy?: string | null;
  now?: Date;
}

export class RunTooDeepError extends Error {
  constructor(workflowName: string) {
    super(
      `“${workflowName}” wasn't started, because automations had already started each other ${MAXIMUM_RUN_DEPTH} times in a row.`,
    );
    this.name = "RunTooDeepError";
  }
}

/**
 * Writes a new queued run, with the workflow's steps copied in. The engine picks it up
 * straight away when it can, and within a minute otherwise.
 */
export async function startWorkflowRun(
  database: DatabaseOrTransaction,
  workflow: WorkflowRow,
  options: StartRunOptions,
): Promise<{ run: WorkflowRunRow; started: boolean }> {
  const depth = options.depth ?? 0;
  if (depth > MAXIMUM_RUN_DEPTH) {
    throw new RunTooDeepError(workflow.name);
  }
  const now = options.now ?? new Date();
  const isTest = options.isTest ?? false;
  const inserted = await insertRunUnlessDuplicate(database, {
    tenantId: DEFAULT_TENANT_ID,
    workflowId: workflow.id,
    workflowName: workflow.name,
    definition: { trigger: workflow.trigger, steps: workflow.steps },
    context: {
      ...options.context,
      workflow: { id: workflow.id, name: workflow.name },
      steps: {},
    },
    idempotencyKey: options.idempotencyKey,
    isTest,
    depth,
    entryId: isTest ? null : entryIdFromContext(options.context),
    startedBy: options.startedBy ?? null,
    nextRunAt: now,
  });
  if (inserted) {
    return { run: inserted, started: true };
  }
  const existing =
    options.idempotencyKey === null
      ? undefined
      : await findRunByIdempotencyKey(database, workflow.id, options.idempotencyKey);
  if (!existing) {
    throw new Error("Saving the workflow run returned nothing.");
  }
  return { run: existing, started: false };
}
