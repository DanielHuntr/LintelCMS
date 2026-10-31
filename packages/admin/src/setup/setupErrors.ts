import { ApiError } from "../api/client.js";
import { t } from "../i18n/strings.js";

/**
 * What went wrong with a setup request, sorted by who deals with it. The flow handles
 * "already-set-up" and "setup-code-rejected", because they change the page or the step.
 * The step shows the rest, next to the right field or in its status line.
 */
export type SetupFailure =
  | { kind: "already-set-up" }
  | { kind: "setup-code-rejected"; message: string }
  | { kind: "unreachable" }
  | { kind: "problem"; code: string; message: string };

export function explainSetupFailure(error: unknown): SetupFailure {
  // fetch throws a TypeError, not an ApiError, when nothing answers at all.
  if (!(error instanceof ApiError)) {
    return { kind: "unreachable" };
  }
  if (error.code === "SETUP_ALREADY_DONE") {
    return { kind: "already-set-up" };
  }
  if (error.code === "SETUP_CODE_REQUIRED" || error.code === "SETUP_CODE_INVALID") {
    return { kind: "setup-code-rejected", message: error.message };
  }
  return { kind: "problem", code: error.code, message: error.message };
}

/**
 * For a step's catch block: hands interruptions to the flow and returns what the step itself
 * should show, or undefined when there is nothing left for the step to do.
 */
export function stepProblemFor(
  error: unknown,
  onInterrupted: (failure: Exclude<SetupFailure, { kind: "problem" | "unreachable" }>) => void,
): { code?: string; message: string } | undefined {
  const failure = explainSetupFailure(error);
  switch (failure.kind) {
    case "problem":
      return { code: failure.code, message: failure.message };
    case "unreachable":
      return { message: t("setup.unreachable") };
    default:
      onInterrupted(failure);
      return undefined;
  }
}
