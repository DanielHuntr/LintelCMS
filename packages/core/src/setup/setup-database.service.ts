import {
  type ActiveDatabase,
  DatabaseConnectionError,
  openChosenDatabase,
} from "../database/active-database.js";
import type { OpenedDatabase } from "../database/client.js";
import {
  type DatabaseChoice,
  type LintelFolder,
  saveDatabaseChoice,
} from "../database/database-choice.js";
import { describeDatabaseError } from "../database/database-errors.js";
import {
  buildPostgresUrl,
  checkPostgresConnection,
  createPostgresDatabase,
  type PostgresConnectionDetails,
} from "../database/postgres-database.js";
import { DatabaseCheckFailedError, DatabaseSetByEnvironmentError } from "./setup.errors.js";
import type { ChooseDatabaseRequest, DatabaseStatus } from "./setup.schema.js";

/**
 * The setup screen's database step: try a Postgres server's details, then switch the
 * running server over to the chosen database and remember the choice for next time.
 */

// Someone is waiting on the setup screen; 30 seconds (postgres' default) feels broken.
const CONNECT_TIMEOUT_SECONDS = 10;

/** Checks that Lintel can sign in to the server and open the database. Changes nothing. */
export async function testPostgresConnection(
  activeDatabase: ActiveDatabase,
  details: PostgresConnectionDetails,
): Promise<void> {
  refuseWhenSetByEnvironment(activeDatabase);
  await checkConnection(details);
}

/**
 * Opens the chosen database, brings its tables up to date, saves the choice in
 * .lintel/config.json and switches the running server over to it. The old connection
 * is closed once nothing uses it, so nobody needs to restart anything.
 */
export async function chooseDatabase(
  activeDatabase: ActiveDatabase,
  lintelFolder: LintelFolder,
  request: ChooseDatabaseRequest,
): Promise<{ database: DatabaseStatus }> {
  refuseWhenSetByEnvironment(activeDatabase);

  const choice: DatabaseChoice =
    request.kind === "built-in" ? { kind: "built-in" } : withoutCreateFlag(request);

  // Already on the built-in database: reopening it would only wait on our own lock.
  const alreadyInUse = choice.kind === "built-in" && activeDatabase.kind === "built-in";
  const next = alreadyInUse ? undefined : await openChoice(choice, lintelFolder, request);

  try {
    saveDatabaseChoice(lintelFolder, choice);
  } catch (error) {
    await next?.close();
    throw error;
  }

  if (next) {
    await activeDatabase.switchTo(next, "setup");
  } else {
    activeDatabase.recordChosenBy("setup");
  }

  return { database: { kind: activeDatabase.kind, chosenBy: activeDatabase.chosenBy } };
}

async function openChoice(
  choice: DatabaseChoice,
  lintelFolder: LintelFolder,
  request: ChooseDatabaseRequest,
): Promise<OpenedDatabase> {
  if (choice.kind === "postgres") {
    await checkConnection(choice, request.kind === "postgres" && request.createIfMissing);
  }

  try {
    return await openChosenDatabase(choice, lintelFolder, "form");
  } catch (error) {
    if (error instanceof DatabaseConnectionError) {
      throw new DatabaseCheckFailedError(error.problem, error.message);
    }
    throw error;
  }
}

/**
 * Connects once. When the database is missing and `createIfMissing` is set, creates it
 * first; any other problem becomes a DatabaseCheckFailedError with a plain message.
 */
async function checkConnection(
  details: PostgresConnectionDetails,
  createIfMissing = false,
): Promise<void> {
  const options = { connectTimeoutSeconds: CONNECT_TIMEOUT_SECONDS };
  try {
    await checkPostgresConnection(buildPostgresUrl(details), options);
    return;
  } catch (error) {
    const described = describeOrRethrow(error, details);
    if (described.problem !== "not-found" || !createIfMissing) {
      throw new DatabaseCheckFailedError(described.problem, described.message);
    }
  }

  try {
    await createPostgresDatabase(details, options);
  } catch (error) {
    const described = describeOrRethrow(error, details);
    throw new DatabaseCheckFailedError(
      "not-found",
      `Lintel couldn't create the database "${details.database}": ${described.message}`,
    );
  }
}

function describeOrRethrow(error: unknown, details: PostgresConnectionDetails) {
  const described = describeDatabaseError(error, details, "form");
  if (!described) {
    throw error;
  }
  return described;
}

function refuseWhenSetByEnvironment(activeDatabase: ActiveDatabase): void {
  if (activeDatabase.chosenBy === "environment") {
    throw new DatabaseSetByEnvironmentError();
  }
}

/** What gets saved: the connection details, without the one-off "create it" request. */
function withoutCreateFlag(
  request: Extract<ChooseDatabaseRequest, { kind: "postgres" }>,
): DatabaseChoice {
  return {
    kind: "postgres",
    host: request.host,
    port: request.port,
    database: request.database,
    user: request.user,
    password: request.password,
    ssl: request.ssl,
  };
}
