import { type SignInResult, startSignedInSession } from "../auth/auth.service.js";
import type { ActiveDatabase } from "../database/active-database.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { readSetting } from "../settings/settings.service.js";
import { hasAnyUsers } from "../users/users.repository.js";
import { createAdmin } from "../users/users.service.js";
import { SetupAlreadyDoneError } from "./setup.errors.js";
import { lockSetup } from "./setup.repository.js";
import type { CompleteSetupRequest, SetupStatus } from "./setup.schema.js";

/**
 * First-run setup: is it still needed, and creating the first admin. Choosing the
 * database is in setup-database.service.ts; the "What are you building?" step is in
 * site-setup.service.ts.
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
 * Creates the first admin, with the Owner role, and signs them in. Refuses once
 * any user exists, so it can never be used to add an admin to a running site.
 */
export async function completeSetup(
  activeDatabase: ActiveDatabase,
  request: CompleteSetupRequest,
  userAgent: string | undefined,
): Promise<SignInResult> {
  const database = activeDatabase.database;

  // Checked once before the transaction too, so a finished install answers straight
  // away instead of hashing a password (deliberately slow) for every stray request.
  if (!(await isSetupNeeded(database))) {
    throw new SetupAlreadyDoneError();
  }

  const admin = await database.transaction(async (transaction) => {
    // Two requests at once: the second waits here, then sees the first one's user.
    await lockSetup(transaction);
    if (!(await isSetupNeeded(transaction))) {
      throw new SetupAlreadyDoneError();
    }
    return createAdmin(transaction, request);
  });

  return startSignedInSession(database, admin, userAgent);
}
