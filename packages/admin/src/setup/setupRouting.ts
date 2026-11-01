import { fetchSetupStatus, type DatabaseKind, type SetupStatus } from "./setup.api.js";

/**
 * The decisions the router makes about setup, kept apart from the router so they can be
 * tested on their own. src/setup/README.md explains the whole flow.
 */

/** Until setup has finished, every admin address (sign-in included) leads to /setup. */
export function mustFinishSetupFirst(pathname: string, needsSetup: boolean): boolean {
  return needsSetup && pathname !== "/setup";
}

/** Where /setup sends people once setup is finished. */
export function destinationOnceSetUp(isSignedIn: boolean): "/" | "/sign-in" {
  return isSignedIn ? "/" : "/sign-in";
}

/** Every screen of setup, in the order they can appear. */
export type SetupScreen =
  | "welcome"
  | "setup-code"
  | "database"
  | "postgres"
  | "account"
  | "site-name"
  | "site-type"
  | "review"
  | "done";

/** The steps in the indicator at the top. "database" covers the PostgreSQL details too. */
export type SetupStep = "database" | "account" | "site-name" | "site-type" | "review";

const allSteps: readonly SetupStep[] = ["database", "account", "site-name", "site-type", "review"];

/**
 * The steps for this install. The database step is left out when DATABASE_URL already
 * decided, since asking would offer a choice that does nothing.
 */
export function setupStepsFor(status: SetupStatus): SetupStep[] {
  return status.database.chosenBy === "environment"
    ? allSteps.filter((step) => step !== "database")
    : [...allSteps];
}

/** The step a screen belongs to; undefined for the welcome, the setup code and the end. */
export function stepOfScreen(screen: SetupScreen): SetupStep | undefined {
  if (screen === "postgres") return "database";
  return allSteps.find((step) => step === screen);
}

/**
 * Every screen in order, for Back and Continue. The setup code only appears when setting up
 * from another computer, and the PostgreSQL details only once PostgreSQL is chosen.
 */
export function setupScreensFor(status: SetupStatus, databaseKind: DatabaseKind): SetupScreen[] {
  const screens: SetupScreen[] = ["welcome"];
  if (status.requiresSetupCode) screens.push("setup-code");
  for (const step of setupStepsFor(status)) {
    screens.push(step);
    if (step === "database" && databaseKind === "postgres") screens.push("postgres");
  }
  screens.push("done");
  return screens;
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
