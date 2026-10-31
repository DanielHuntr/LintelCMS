import { fetchSetupStatus, type DatabaseKind, type SetupStatus } from "./setup.api.js";

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

/** Every screen of setup, in the order they can appear. */
export type SetupScreen =
  | "welcome"
  | "setup-code"
  | "database"
  | "postgres"
  | "name"
  | "email"
  | "password"
  | "site-type"
  | "features"
  | "done";

export type AccountScreen = Extract<
  SetupScreen,
  "welcome" | "setup-code" | "database" | "postgres" | "name" | "email" | "password"
>;
export type SiteScreen = Extract<SetupScreen, "site-type" | "features" | "done">;

export const siteScreens: readonly SiteScreen[] = ["site-type", "features", "done"];

/**
 * The screens at /setup, before the account exists. The setup code only appears when
 * setting up from another computer. The database screens are skipped when DATABASE_URL
 * already decided, since asking would offer a choice that does nothing, and the PostgreSQL
 * details only appear once PostgreSQL is chosen.
 */
export function accountScreensFor(
  status: SetupStatus,
  databaseKind: DatabaseKind,
): AccountScreen[] {
  const screens: AccountScreen[] = ["welcome"];
  if (status.requiresSetupCode) screens.push("setup-code");
  if (status.database.chosenBy !== "environment") {
    screens.push("database");
    if (databaseKind === "postgres") screens.push("postgres");
  }
  screens.push("name", "email", "password");
  return screens;
}

/** How far through the whole of setup a screen is, from 0 (welcome) to 1 (done). */
export function setupProgress(
  screen: SetupScreen,
  status: SetupStatus,
  databaseKind: DatabaseKind,
): number {
  const allScreens: SetupScreen[] = [...accountScreensFor(status, databaseKind), ...siteScreens];
  return Math.max(allScreens.indexOf(screen), 0) / (allScreens.length - 1);
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
