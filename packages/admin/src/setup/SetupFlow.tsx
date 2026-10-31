import { useState } from "react";
import type { Session } from "../session/session.api.js";
import { AccountStep } from "./AccountStep.js";
import { DatabaseStep } from "./DatabaseStep.js";
import type { SetupApi, SetupStatus } from "./setup.api.js";
import { rememberedSetupCode, rememberSetupCode } from "./setupCode.js";
import { SetupCodeStep } from "./SetupCodeStep.js";
import type { SetupFailure } from "./setupErrors.js";
import { setupStepsFor, stepNumberOf, type SetupStep } from "./setupRouting.js";

interface SetupFlowProps {
  status: SetupStatus;
  api: Pick<SetupApi, "testDatabaseConnection" | "chooseDatabase" | "createFirstAccount">;
  onAccountCreated: (session: Session) => void;
  onAlreadySetUp: () => void;
}

/**
 * The steps at /setup, before the account exists: the setup code (only from another
 * computer), the database (unless DATABASE_URL chose it) and the account. "What are you
 * building?" comes next at /setup/site, because by then the person is signed in.
 */
export function SetupFlow({ status, api, onAccountCreated, onAlreadySetUp }: SetupFlowProps) {
  const steps: SetupStep[] = setupStepsFor(status).filter((step) => step !== "site");
  const [currentStep, setCurrentStep] = useState<SetupStep>(steps[0] ?? "account");
  // The first step shown keeps the page's natural focus; later ones take it (see StepPanel).
  const [hasMovedOn, setHasMovedOn] = useState(false);
  const [setupCode, setSetupCode] = useState(rememberedSetupCode() ?? "");
  const [setupCodeError, setSetupCodeError] = useState<string>();

  function goTo(step: SetupStep) {
    setCurrentStep(step);
    setHasMovedOn(true);
  }

  function stepAfter(step: SetupStep): SetupStep {
    return steps[steps.indexOf(step) + 1] ?? "account";
  }

  function handleInterrupted(failure: Exclude<SetupFailure, { kind: "problem" | "unreachable" }>) {
    if (failure.kind === "already-set-up") {
      onAlreadySetUp();
      return;
    }
    // The code was wrong or missing: back to where it's entered, with the API's explanation.
    setSetupCodeError(failure.message);
    goTo("setup-code");
  }

  const codeToSend = status.requiresSetupCode ? setupCode : undefined;

  switch (currentStep) {
    case "setup-code":
      return (
        <SetupCodeStep
          initialCode={setupCode}
          error={setupCodeError}
          takesFocus={hasMovedOn}
          onContinue={(code) => {
            setSetupCode(code);
            rememberSetupCode(code);
            setSetupCodeError(undefined);
            goTo(stepAfter("setup-code"));
          }}
        />
      );
    case "database":
      return (
        <DatabaseStep
          api={api}
          setupCode={codeToSend}
          stepNumber={stepNumberOf("database", status)}
          takesFocus={hasMovedOn}
          onSaved={() => goTo("account")}
          onInterrupted={handleInterrupted}
        />
      );
    default:
      return (
        <AccountStep
          api={api}
          setupCode={codeToSend}
          stepNumber={stepNumberOf("account", status)}
          takesFocus={hasMovedOn}
          usesEnvironmentDatabase={status.database.chosenBy === "environment"}
          onBack={steps.includes("database") ? () => goTo("database") : undefined}
          onCreated={onAccountCreated}
          onInterrupted={handleInterrupted}
        />
      );
  }
}
