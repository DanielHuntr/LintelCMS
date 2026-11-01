import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { generateWebhookSecret } from "../webhooks/webhook-signatures.js";
import { describeRunSummary } from "./engine/workflow-runs.service.js";
import { findLatestRunRows } from "./engine/workflow-runs.repository.js";
import { parseJsonTemplate } from "./engine/templates.js";
import {
  findDuplicateStepIds,
  listAllSteps,
  type WorkflowStep,
} from "./workflow-definition.schema.js";
import { InvalidWorkflowError, WorkflowNotFoundError } from "./workflows.errors.js";
import {
  deleteWorkflowRow,
  findWorkflowRow,
  insertWorkflow,
  listWorkflowRows,
  updateWorkflowRow,
} from "./workflows.repository.js";
import type {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowResponse,
} from "./workflows.schema.js";
import type { WorkflowRow, WorkflowRunRow } from "./workflows.table.js";

/** Adding, changing and removing workflows. Running them is in engine/. */

export async function listWorkflows(
  database: DatabaseOrTransaction,
): Promise<{ workflows: WorkflowResponse[] }> {
  const rows = await listWorkflowRows(database, DEFAULT_TENANT_ID);
  const latest = await findLatestRunRows(
    database,
    rows.map((row) => row.id),
  );
  const latestByWorkflow = new Map(latest.map((run) => [run.workflowId, run]));
  return { workflows: rows.map((row) => describeWorkflow(row, latestByWorkflow.get(row.id))) };
}

export async function findWorkflowOrFail(
  database: DatabaseOrTransaction,
  workflowId: string,
): Promise<WorkflowRow> {
  const workflow = await findWorkflowRow(database, DEFAULT_TENANT_ID, workflowId);
  if (!workflow) {
    throw new WorkflowNotFoundError();
  }
  return workflow;
}

export async function findWorkflow(
  database: DatabaseOrTransaction,
  workflowId: string,
): Promise<WorkflowResponse> {
  const workflow = await findWorkflowOrFail(database, workflowId);
  const [latest] = await findLatestRunRows(database, [workflow.id]);
  return describeWorkflow(workflow, latest);
}

export async function createWorkflow(
  database: DatabaseOrTransaction,
  request: CreateWorkflowRequest,
  createdBy: string | null,
  purpose: string | null = null,
): Promise<WorkflowResponse> {
  checkSteps(request.steps, undefined);
  const workflow = await insertWorkflow(database, {
    tenantId: DEFAULT_TENANT_ID,
    name: request.name,
    description: request.description,
    enabled: request.enabled,
    trigger: request.trigger,
    steps: request.steps,
    secret: generateWebhookSecret(),
    purpose,
    createdBy,
  });
  return describeWorkflow(workflow, undefined);
}

export async function updateWorkflow(
  database: DatabaseOrTransaction,
  workflowId: string,
  changes: UpdateWorkflowRequest,
): Promise<WorkflowResponse> {
  const workflow = await findWorkflowOrFail(database, workflowId);
  if (changes.steps) {
    checkSteps(changes.steps, workflow.id);
  }
  await updateWorkflowRow(database, workflow.id, changes);
  return findWorkflow(database, workflow.id);
}

export async function deleteWorkflow(database: DatabaseOrTransaction, workflowId: string) {
  const workflow = await findWorkflowOrFail(database, workflowId);
  await deleteWorkflowRow(database, workflow.id);
}

/** What the schema can't check alone: unique step ids, JSON bodies, not calling itself. */
function checkSteps(steps: readonly WorkflowStep[], workflowId: string | undefined): void {
  const duplicates = findDuplicateStepIds(steps);
  if (duplicates.length > 0) {
    throw new InvalidWorkflowError(
      `Each step needs its own id; these are used twice: ${duplicates.join(", ")}`,
    );
  }
  for (const step of listAllSteps(steps)) {
    if (step.type === "http_request" && step.body.trim() !== "") {
      try {
        parseJsonTemplate(step.body);
      } catch (error) {
        throw new InvalidWorkflowError(
          `The body of step “${step.id}” isn't valid JSON. ${error instanceof Error ? error.message : ""}`.trim(),
        );
      }
    }
    if (step.type === "run_workflow" && step.workflowId === workflowId) {
      throw new InvalidWorkflowError("A workflow can't run itself.");
    }
  }
}

export function describeWorkflow(
  row: WorkflowRow,
  lastRun: WorkflowRunRow | undefined,
): WorkflowResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    trigger: row.trigger,
    steps: row.steps,
    secret: row.secret,
    purpose: row.purpose,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastRun: lastRun ? describeRunSummary(lastRun) : null,
  };
}
