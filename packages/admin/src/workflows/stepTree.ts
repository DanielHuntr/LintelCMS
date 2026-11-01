import type { StepType, WorkflowStep } from "./workflows.types.js";

/**
 * Changes to the tree of steps, without changing the original. Branching steps
 * (conditions and approvals) hold two lists, `then` and `otherwise`; a place in the tree
 * is the list's owner (null for the top) and which of its lists.
 */
export interface StepPlace {
  parentId: string | null;
  branch: "then" | "otherwise" | null;
}

export const topOfFlow: StepPlace = { parentId: null, branch: null };

export function insertStep(
  steps: readonly WorkflowStep[],
  place: StepPlace,
  index: number,
  step: WorkflowStep,
): WorkflowStep[] {
  return changeList(steps, place, (list) => [...list.slice(0, index), step, ...list.slice(index)]);
}

export function replaceStep(steps: readonly WorkflowStep[], step: WorkflowStep): WorkflowStep[] {
  return steps.map((candidate) => {
    if (candidate.id === step.id) return step;
    if (candidate.type === "condition" || candidate.type === "approval") {
      return {
        ...candidate,
        then: replaceStep(candidate.then, step),
        otherwise: replaceStep(candidate.otherwise, step),
      };
    }
    return candidate;
  });
}

export function removeStep(steps: readonly WorkflowStep[], stepId: string): WorkflowStep[] {
  return steps
    .filter((step) => step.id !== stepId)
    .map((step) =>
      step.type === "condition" || step.type === "approval"
        ? {
            ...step,
            then: removeStep(step.then, stepId),
            otherwise: removeStep(step.otherwise, stepId),
          }
        : step,
    );
}

/** Swaps a step with its neighbour in the same list. */
export function moveStep(
  steps: readonly WorkflowStep[],
  stepId: string,
  direction: -1 | 1,
): WorkflowStep[] {
  const index = steps.findIndex((step) => step.id === stepId);
  if (index !== -1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return [...steps];
    const moved = [...steps];
    const [step] = moved.splice(index, 1);
    if (step) moved.splice(target, 0, step);
    return moved;
  }
  return steps.map((step) =>
    step.type === "condition" || step.type === "approval"
      ? {
          ...step,
          then: moveStep(step.then, stepId, direction),
          otherwise: moveStep(step.otherwise, stepId, direction),
        }
      : step,
  );
}

export function allStepIds(steps: readonly WorkflowStep[]): string[] {
  return steps.flatMap((step) =>
    step.type === "condition" || step.type === "approval"
      ? [step.id, ...allStepIds(step.then), ...allStepIds(step.otherwise)]
      : [step.id],
  );
}

const idPrefixes: Record<StepType, string> = {
  send_email: "email",
  http_request: "call",
  update_entry_field: "change",
  publish_entry: "publish",
  unpublish_entry: "unpublish",
  notify_users: "notify",
  wait: "wait",
  run_workflow: "run",
  condition: "check",
  approval: "approval",
};

/** "email1", "email2"…: short, readable in templates as {{steps.call1.body}}. */
export function newStepId(type: StepType, steps: readonly WorkflowStep[]): string {
  const taken = new Set(allStepIds(steps));
  let number = 1;
  while (taken.has(`${idPrefixes[type]}${number}`)) number += 1;
  return `${idPrefixes[type]}${number}`;
}

/** A new step with sensible defaults, ready to fill in. */
export function createStep(type: StepType, id: string): WorkflowStep {
  switch (type) {
    case "send_email":
      return { id, type, to: { type: "actor" }, subject: "", body: "" };
    case "http_request":
      return {
        id,
        type,
        url: "",
        method: "POST",
        headers: [],
        body: "",
        sign: true,
        timeoutSeconds: 10,
      };
    case "update_entry_field":
      return { id, type, field: "", value: "" };
    case "publish_entry":
    case "unpublish_entry":
      return { id, type };
    case "notify_users":
      return { id, type, to: { type: "actor" }, message: "" };
    case "wait":
      return { id, type, amount: 1, unit: "days" };
    case "run_workflow":
      return { id, type, workflowId: "" };
    case "condition":
      return {
        id,
        type,
        match: "all",
        conditions: [{ type: "field_equals", field: "", value: "" }],
        then: [],
        otherwise: [],
      };
    case "approval":
      return {
        id,
        type,
        role: "super-admin",
        message: "",
        expiresAfterDays: null,
        then: [],
        otherwise: [],
      };
  }
}

function changeList(
  steps: readonly WorkflowStep[],
  place: StepPlace,
  change: (list: readonly WorkflowStep[]) => WorkflowStep[],
): WorkflowStep[] {
  if (place.parentId === null || place.branch === null) {
    return change(steps);
  }
  const { parentId, branch } = place;
  return steps.map((step) => {
    if (step.type !== "condition" && step.type !== "approval") return step;
    if (step.id === parentId) return { ...step, [branch]: change(step[branch]) };
    return {
      ...step,
      then: changeList(step.then, place, change),
      otherwise: changeList(step.otherwise, place, change),
    };
  });
}
