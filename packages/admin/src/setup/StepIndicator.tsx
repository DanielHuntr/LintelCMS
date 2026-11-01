import { Check } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { SetupStep } from "./setupRouting.js";

const stepLabels: Record<SetupStep, StringKey> = {
  database: "steps.database",
  account: "steps.account",
  "site-name": "steps.siteName",
  "site-type": "steps.siteType",
  review: "steps.review",
};

export function stepLabel(step: SetupStep): string {
  return t(stepLabels[step]);
}

interface StepIndicatorProps {
  steps: readonly SetupStep[];
  current: SetupStep;
  /** Steps the person has been to: they can go back (or forward again) to these. */
  visited: readonly SetupStep[];
  /** Steps whose answers have been checked: shown with a tick. */
  completed: readonly SetupStep[];
  onGoTo: (step: SetupStep) => void;
}

/**
 * The steps of setup along the top, like a segmented control: the current one highlighted,
 * finished ones ticked, the rest shown but not yet reachable. A navigation landmark with an
 * ordered list, where each button is named "Step 2 of 5: Your account" and the current one has
 * aria-current="step". On phones only the current step keeps its label.
 */
export function StepIndicator({ steps, current, visited, completed, onGoTo }: StepIndicatorProps) {
  return (
    <nav
      aria-label={t("steps.label")}
      className="fixed inset-x-0 top-0 z-20 flex justify-center px-16 pt-4 sm:pt-6"
    >
      <ol className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-fill p-1">
        {steps.map((step, index) => {
          const isCurrent = step === current;
          const isCompleted = completed.includes(step) && !isCurrent;
          const isReachable = visited.includes(step) || isCompleted;
          const position = t("steps.position", { number: index + 1, total: steps.length });
          const state = isCompleted
            ? `, ${t("steps.completed")}`
            : isReachable || isCurrent
              ? ""
              : `, ${t("steps.notYet")}`;

          return (
            <li key={step} className="shrink-0">
              <button
                type="button"
                aria-label={`${position}: ${stepLabel(step)}${state}`}
                aria-current={isCurrent ? "step" : undefined}
                disabled={!isReachable && !isCurrent}
                onClick={() => !isCurrent && onGoTo(step)}
                className={classNames(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-footnote font-medium whitespace-nowrap",
                  "transition-colors duration-200 ease-standard motion-reduce:transition-none",
                  "focus-visible:focus-ring disabled:cursor-default",
                  isCurrent
                    ? "bg-segment text-label shadow-thumb"
                    : isReachable
                      ? "text-label-secondary hover:text-label"
                      : "text-label-tertiary",
                )}
              >
                <span
                  aria-hidden="true"
                  className={classNames(
                    "flex size-5 items-center justify-center rounded-full text-caption",
                    isCompleted
                      ? "bg-accent-fill text-on-accent"
                      : isCurrent
                        ? "bg-label text-background"
                        : "ring-1 ring-current",
                  )}
                >
                  {isCompleted ? <Check strokeWidth={3} className="size-3" /> : index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className={classNames(!isCurrent && "sr-only sm:not-sr-only")}
                >
                  {stepLabel(step)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
