import { useState } from "react";
import type { DatabaseKind, SetupStatus } from "./setup.api.js";
import type { SetupProgress } from "./setupAnswers.js";
import {
  setupScreensFor,
  setupStepsFor,
  stepOfScreen,
  type SetupScreen,
  type SetupStep,
} from "./setupRouting.js";
import { useWizardScreens, type WizardDirection } from "./useWizardScreens.js";

/**
 * Which setup screen is showing, which steps have been visited (the step indicator lets
 * people go back to those) and which have been checked and ticked.
 */
export function useSetupNavigation(
  status: SetupStatus,
  databaseKind: DatabaseKind,
  restored: SetupProgress | undefined,
) {
  const { screen, goTo } = useWizardScreens<SetupScreen>(restored?.screen ?? "welcome");
  const [visitedSteps, setVisitedSteps] = useState<SetupStep[]>(restored?.visitedSteps ?? []);
  const [completedSteps, setCompletedSteps] = useState<SetupStep[]>(restored?.completedSteps ?? []);

  function show(to: SetupScreen, direction: WizardDirection = "forward") {
    const step = stepOfScreen(to);
    if (step && !visitedSteps.includes(step)) setVisitedSteps([...visitedSteps, step]);
    goTo(to, direction);
  }

  /** On to the next screen, ticking the step just finished. `kind` is the choice just made. */
  function next(kind: DatabaseKind = databaseKind) {
    const step = stepOfScreen(screen);
    if (step && screen !== "database" && !completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
    if (screen === "database" && kind === "built-in" && !completedSteps.includes("database")) {
      setCompletedSteps([...completedSteps, "database"]);
    }
    const screens = setupScreensFor(status, kind);
    show(screens[screens.indexOf(screen) + 1] ?? "review");
  }

  function back() {
    const screens = setupScreensFor(status, databaseKind);
    show(screens[screens.indexOf(screen) - 1] ?? "welcome", "back");
  }

  /** Jumps to a step's first screen, sliding in from the side it is on. */
  function goToStep(step: SetupStep) {
    const steps = setupStepsFor(status);
    const current = stepOfScreen(screen);
    const isEarlier = current !== undefined && steps.indexOf(step) < steps.indexOf(current);
    show(step, isEarlier ? "back" : "forward");
  }

  const progress: SetupProgress = { screen, visitedSteps, completedSteps };
  return { screen, progress, show, next, back, goToStep };
}
