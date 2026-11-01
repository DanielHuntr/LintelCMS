import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { requestApproval, readApprovalOutcome } from "../approvals/approval-steps.js";
import type { ApprovalStep, ConditionStep, WorkflowStep } from "../workflow-definition.schema.js";
import { findWorkflowRow } from "../workflows.repository.js";
import type { StepLogStatus, StepState, WorkflowRunRow } from "../workflows.table.js";
import { ActionFailedError } from "./action-result.js";
import { describeConditions, evaluateConditions } from "./conditions.js";
import { retryDelayMilliseconds } from "./retries.js";
import type { RunContext } from "./run-context.js";
import { performAction } from "./step-actions.js";
import { InvalidJsonTemplateError } from "./templates.js";
import { insertStepLog, updateRunRow } from "./workflow-runs.repository.js";
import type { WorkflowServices } from "./workflow-services.js";

/** A step that hasn't answered in this long is treated as a failed attempt. */
const STEP_TIMEOUT_MILLISECONDS = 60_000;
/** A loop guard; a workflow has at most 100 steps, so a real run never comes near. */
const MAXIMUM_STEPS_PER_PASS = 500;
const ONE_MINUTE = 60_000;

type Outcome =
  { kind: "continue" } | { kind: "pause"; until: Date | null } | { kind: "fail"; message: string };

/** One pass over a claimed run: what it has, and where it has got to. */
interface RunPass {
  run: WorkflowRunRow;
  secret: string;
  context: RunContext & { steps: Record<string, unknown> };
  stepStates: Record<string, StepState>;
  services: WorkflowServices;
  now: Date;
  stepsTaken: number;
}

/**
 * Carries a claimed run as far as it can go: to the end, to a step that has to wait (a
 * delay, an approval, a retry), or to a failure.
 *
 * Every pass starts again from the first step and skips the ones already done (their
 * results are in `stepStates`), so a run picks up correctly after a restart, and a
 * finished step is never done twice. Progress is saved after every step.
 */
export async function advanceRun(services: WorkflowServices, run: WorkflowRunRow, now: Date) {
  const workflow = await findWorkflowRow(services.database(), DEFAULT_TENANT_ID, run.workflowId);
  const pass: RunPass = {
    run,
    secret: workflow?.secret ?? "",
    context: { ...run.context, steps: { ...(run.context.steps as Record<string, unknown>) } },
    stepStates: { ...run.stepStates },
    services,
    now,
    stepsTaken: 0,
  };
  let outcome: Outcome;
  try {
    outcome = await runSteps(pass, run.definition.steps);
  } catch (error) {
    // Something unexpected, such as the database going away: try the run again shortly.
    await saveProgress(pass, {
      status: "queued",
      nextRunAt: new Date(now.getTime() + (retryDelayMilliseconds(1) ?? ONE_MINUTE)),
      leaseUntil: null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  await finishPass(pass, outcome);
}

async function finishPass(pass: RunPass, outcome: Outcome): Promise<void> {
  if (outcome.kind === "continue") {
    await saveProgress(pass, {
      status: "succeeded",
      finishedAt: pass.now,
      leaseUntil: null,
      error: null,
    });
  } else if (outcome.kind === "pause") {
    await saveProgress(pass, { status: "waiting", nextRunAt: outcome.until, leaseUntil: null });
  } else {
    await saveProgress(pass, {
      status: "failed",
      finishedAt: pass.now,
      leaseUntil: null,
      error: outcome.message,
    });
  }
}

async function runSteps(pass: RunPass, steps: readonly WorkflowStep[]): Promise<Outcome> {
  for (const step of steps) {
    const outcome = await runStep(pass, step);
    if (outcome.kind !== "continue") {
      return outcome;
    }
  }
  return { kind: "continue" };
}

async function runStep(pass: RunPass, step: WorkflowStep): Promise<Outcome> {
  const state = pass.stepStates[step.id];
  if (state?.status === "done") {
    return state.branch && "then" in step
      ? runSteps(pass, step[state.branch])
      : { kind: "continue" };
  }
  pass.stepsTaken += 1;
  if (pass.stepsTaken > MAXIMUM_STEPS_PER_PASS) {
    return { kind: "fail", message: "The workflow ran too many steps in one go" };
  }
  switch (step.type) {
    case "condition":
      return runCondition(pass, step);
    case "approval":
      return runApproval(pass, step, state);
    case "wait":
      return runWait(pass, step, state);
    default:
      return runAction(pass, step, state);
  }
}

async function runCondition(pass: RunPass, step: ConditionStep): Promise<Outcome> {
  const matched = evaluateConditions(step, pass.context);
  const branch = matched ? "then" : "otherwise";
  await completeStep(
    pass,
    step,
    { branch, output: { matched } },
    {
      status: "succeeded",
      summary: `${describeConditions(step)}: ${matched ? "yes" : "no"}`,
    },
  );
  return runSteps(pass, step[branch]);
}

async function runApproval(
  pass: RunPass,
  step: ApprovalStep,
  state: StepState | undefined,
): Promise<Outcome> {
  if (pass.run.isTest) {
    await completeStep(
      pass,
      step,
      { branch: "then", output: { decision: "approved" } },
      {
        status: "skipped",
        summary: "In a test run, approvals count as approved",
      },
    );
    return runSteps(pass, step.then);
  }
  if (!state?.approvalId) {
    const approval = await requestApproval(pass.services, pass.run, step, pass.context, pass.now);
    pass.stepStates[step.id] = { status: "waiting", attempts: 1, approvalId: approval.id };
    await log(pass, step, "waiting", `Waiting for someone with the “${step.role}” role to answer`);
    return { kind: "pause", until: approval.expiresAt };
  }
  const outcome = await readApprovalOutcome(pass.services, state.approvalId, pass.now);
  if (outcome.decision === "pending") {
    return { kind: "pause", until: outcome.expiresAt };
  }
  const branch = outcome.decision === "approved" ? "then" : "otherwise";
  await completeStep(
    pass,
    step,
    { branch, output: outcome },
    {
      status: "succeeded",
      summary: outcome.summary,
    },
  );
  return runSteps(pass, step[branch]);
}

async function runWait(
  pass: RunPass,
  step: Extract<WorkflowStep, { type: "wait" }>,
  state: StepState | undefined,
): Promise<Outcome> {
  if (pass.run.isTest) {
    await completeStep(
      pass,
      step,
      {},
      { status: "skipped", summary: "In a test run, waits are skipped" },
    );
    return { kind: "continue" };
  }
  if (!state?.waitUntil) {
    const minutes = { minutes: 1, hours: 60, days: 1440 }[step.unit] * step.amount;
    const waitUntil = new Date(pass.now.getTime() + minutes * 60_000);
    pass.stepStates[step.id] = {
      status: "waiting",
      attempts: 1,
      waitUntil: waitUntil.toISOString(),
    };
    await log(pass, step, "waiting", `Waiting ${step.amount} ${step.unit}`);
    return { kind: "pause", until: waitUntil };
  }
  const waitUntil = new Date(state.waitUntil);
  if (waitUntil > pass.now) {
    return { kind: "pause", until: waitUntil };
  }
  await completeStep(pass, step, {}, { status: "succeeded", summary: "Finished waiting" });
  return { kind: "continue" };
}

async function runAction(
  pass: RunPass,
  step: Extract<
    WorkflowStep,
    { type: Exclude<WorkflowStep["type"], "condition" | "approval" | "wait"> }
  >,
  state: StepState | undefined,
): Promise<Outcome> {
  const attempt = (state?.attempts ?? 0) + 1;
  try {
    const result = await withTimeout(
      performAction(step, {
        run: pass.run,
        secret: pass.secret,
        context: pass.context,
        services: pass.services,
        now: pass.now,
      }),
    );
    await completeStep(
      pass,
      step,
      { output: result.output ?? null, attempts: attempt },
      {
        status: "succeeded",
        summary: result.summary,
        detail: result.detail,
        attempt,
      },
    );
    return { kind: "continue" };
  } catch (error) {
    const failure = toActionFailure(error);
    const delay = failure.retryable ? retryDelayMilliseconds(attempt) : null;
    if (delay !== null) {
      pass.stepStates[step.id] = { status: "retrying", attempts: attempt };
      await log(
        pass,
        step,
        "retrying",
        `${failure.message}. Trying again soon.`,
        failure.detail,
        attempt,
      );
      return { kind: "pause", until: new Date(pass.now.getTime() + delay) };
    }
    await log(pass, step, "failed", failure.message, failure.detail, attempt);
    return { kind: "fail", message: failure.message };
  }
}

function toActionFailure(error: unknown): ActionFailedError {
  if (error instanceof ActionFailedError) return error;
  if (error instanceof InvalidJsonTemplateError) return new ActionFailedError(error.message, false);
  return new ActionFailedError(error instanceof Error ? error.message : String(error), true);
}

async function completeStep(
  pass: RunPass,
  step: WorkflowStep,
  state: Partial<StepState>,
  line: {
    status: StepLogStatus;
    summary: string;
    detail?: Record<string, unknown>;
    attempt?: number;
  },
): Promise<void> {
  pass.stepStates[step.id] = { status: "done", attempts: state.attempts ?? 1, ...state };
  pass.context.steps[step.id] = { status: line.status, ...asObject(state.output) };
  await log(pass, step, line.status, line.summary, line.detail, line.attempt);
  await saveProgress(pass, {});
}

async function log(
  pass: RunPass,
  step: WorkflowStep,
  status: StepLogStatus,
  summary: string,
  detail?: Record<string, unknown>,
  attempt = 1,
): Promise<void> {
  await insertStepLog(pass.services.database(), {
    tenantId: pass.run.tenantId,
    runId: pass.run.id,
    stepId: step.id,
    stepType: step.type,
    status,
    summary,
    detail: detail ?? null,
    attempt,
  });
}

async function saveProgress(
  pass: RunPass,
  changes: Parameters<typeof updateRunRow>[2],
): Promise<void> {
  await updateRunRow(pass.services.database(), pass.run.id, {
    ...changes,
    stepStates: pass.stepStates,
    context: pass.context,
  });
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return value === undefined || value === null ? {} : { value };
}

async function withTimeout<Result>(work: Promise<Result>): Promise<Result> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new ActionFailedError("The step took too long", true)),
      STEP_TIMEOUT_MILLISECONDS,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
