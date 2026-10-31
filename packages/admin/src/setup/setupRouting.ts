import { fetchSetupStatus, type SetupStatus } from "./setup.api.js";

/**
 * The decisions the router makes about setup, kept apart from the router so they can be
 * tested on their own. src/setup/README.md explains the whole flow.
 */

/** Until the first account exists, every admin address (sign-in included) leads to /setup. */
export function mustFinishSetupFirst(pathname: string, needsSetup: boolean): boolean {
  return needsSetup && pathname !== "/setup";
}

/**
 * The account exists but "What are you building?" hasn't been answered, say because the tab
 * was closed straight after creating the account. The admin sends people back to finish it.
 */
export function mustChooseSiteFirst(status: SetupStatus): boolean {
  return !status.needsSetup && !status.siteSetupCompleted;
}

/** Where /setup sends people once the account exists. */
export function destinationOnceSetUp(
  isSignedIn: boolean,
  siteSetupCompleted: boolean,
): "/" | "/sign-in" | "/setup/site" {
  if (!isSignedIn) return "/sign-in";
  return siteSetupCompleted ? "/" : "/setup/site";
}

export type SetupStep = "setup-code" | "database" | "account" | "site";

/**
 * Every step this person will see, in order. The setup code only appears when setting up
 * from another computer, and the database step is skipped when DATABASE_URL already decided,
 * since asking would offer a choice that does nothing.
 */
export function setupStepsFor(status: SetupStatus): SetupStep[] {
  const steps: SetupStep[] = [];
  if (status.requiresSetupCode) steps.push("setup-code");
  if (status.database.chosenBy !== "environment") steps.push("database");
  steps.push("account", "site");
  return steps;
}

/**
 * "Step 2 of 3" for the step indicator. The setup code is a check rather than a step of
 * setting up, so it isn't counted and has no number.
 */
export function stepNumberOf(
  step: SetupStep,
  status: SetupStatus,
): { current: number; total: number } | undefined {
  const numberedSteps: SetupStep[] = setupStepsFor(status).filter((each) => each !== "setup-code");
  const index = numberedSteps.indexOf(step);
  return index === -1 ? undefined : { current: index + 1, total: numberedSteps.length };
}

let finishedStatus: SetupStatus | undefined;

/**
 * The setup status, asked for on every navigation until setup is complete. A finished setup
 * can't be undone, so from then on the answer is remembered and no request is made.
 */
export async function checkSetupStatus(): Promise<SetupStatus> {
  if (finishedStatus) return finishedStatus;
  const status = await fetchSetupStatus();
  if (!status.needsSetup && status.siteSetupCompleted) finishedStatus = status;
  return status;
}
