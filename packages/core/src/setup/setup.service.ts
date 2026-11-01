import { type SignInResult, startSignedInSession } from "../auth/auth.service.js";
import type { ActiveDatabase } from "../database/active-database.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { LintelFolder } from "../database/database-choice.js";
import type { PluginCatalogue } from "../plugins/plugin-catalogue.js";
import { readSetting } from "../settings/settings.service.js";
import { hasAnyUsers } from "../users/users.repository.js";
import { createAdmin, requireStrongPassword } from "../users/users.service.js";
import { chooseDatabase } from "./setup-database.service.js";
import { duringStep, SetupAlreadyDoneError } from "./setup.errors.js";
import { lockSetup } from "./setup.repository.js";
import type { FinishSetupRequest, SetupStatus } from "./setup.schema.js";
import { saveSiteChoices } from "./site-setup.service.js";

/**
 * First-run setup: is it still needed, and finishing it. The setup screens only check
 * answers as people go; nothing is saved until `finishSetup` applies them all at once.
 */

/** Setup is needed until the first user exists. */
export async function isSetupNeeded(database: DatabaseOrTransaction): Promise<boolean> {
  return !(await hasAnyUsers(database, DEFAULT_TENANT_ID));
}

export async function findSetupStatus(
  activeDatabase: ActiveDatabase,
  requestIsLocal: boolean,
): Promise<SetupStatus> {
  const needsSetup = await isSetupNeeded(activeDatabase.database);
  return {
    needsSetup,
    database: { kind: activeDatabase.kind, chosenBy: activeDatabase.chosenBy },
    requiresSetupCode: needsSetup && !requestIsLocal,
    siteSetupCompleted: await readSetting(activeDatabase.database, "siteSetupCompleted"),
  };
}

/**
 * Applies every setup answer and signs the owner in:
 *
 * 1. Checks what can be checked without changing anything (the password's strength).
 * 2. Switches to the chosen database and brings its tables up to date, unless DATABASE_URL
 *    already decided. A database that can't be used stops here, with nothing else saved.
 * 3. In one transaction on that database: the owner's account (Owner), the site's
 *    name and kind, and its features. Either all of it is saved or none of it.
 *
 * Problems are labelled with the step they belong to (see `duringStep`). Finishing again
 * after a problem is safe: choosing the same database twice changes nothing.
 * Refuses once any user exists, so it can never add an admin to a running site.
 */
export async function finishSetup(
  activeDatabase: ActiveDatabase,
  lintelFolder: LintelFolder,
  catalogue: PluginCatalogue,
  request: FinishSetupRequest,
  userAgent: string | undefined,
): Promise<SignInResult> {
  // Checked first, so a finished install answers straight away instead of hashing a
  // password (deliberately slow) for every stray request.
  if (!(await isSetupNeeded(activeDatabase.database))) {
    throw new SetupAlreadyDoneError();
  }

  const { account, site } = request;
  await duringStep("account", () =>
    requireStrongPassword(account.password, account.name, account.email),
  );

  const databaseChoice = request.database;
  if (databaseChoice && activeDatabase.chosenBy !== "environment") {
    await duringStep("database", () =>
      chooseDatabase(activeDatabase, lintelFolder, databaseChoice),
    );
  }

  const database = activeDatabase.database;
  const owner = await database.transaction(async (transaction) => {
    // Two requests at once: the second waits here, then sees the first one's user.
    await lockSetup(transaction);
    if (!(await isSetupNeeded(transaction))) {
      throw new SetupAlreadyDoneError();
    }
    const created = await duringStep("account", () => createAdmin(transaction, account));
    await duringStep("site", () => saveSiteChoices(transaction, catalogue, site));
    return created;
  });

  return startSignedInSession(database, owner, userAgent);
}
