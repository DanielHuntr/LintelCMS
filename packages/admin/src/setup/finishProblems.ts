import type { ApiError } from "../api/client.js";
import { fieldForAccountMessage, type AccountProblems } from "./accountDetails.js";
import { placeDatabaseProblem, type ConnectionErrors } from "./postgresConnection.js";
import type { SetupStep } from "./setupRouting.js";

/**
 * Where a problem from "Finish setup" belongs. The API names the step (`details.step`:
 * "database", "account" or "site") and often the fields; this turns that into the step to
 * go back to and the messages to show there.
 */
export interface PlacedFinishProblem {
  step: SetupStep;
  accountErrors: AccountProblems;
  connectionErrors: ConnectionErrors;
  siteNameError: string | undefined;
  /** Shown in the step's status line when no field fits. */
  statusMessage: string;
}

export function placeFinishProblem(error: ApiError): PlacedFinishProblem | undefined {
  const apiStep = error.details.step;
  const fields = error.fields ?? {};
  const placed: PlacedFinishProblem = {
    step: "review",
    accountErrors: {},
    connectionErrors: {},
    siteNameError: undefined,
    statusMessage: "",
  };

  if (apiStep === "database") {
    const database = placeDatabaseProblem({ code: error.code, message: error.message });
    return { ...placed, step: "database", ...databaseMessages(database) };
  }
  if (apiStep === "account") {
    const accountErrors = accountMessages(fields, error.message);
    const statusMessage = Object.keys(accountErrors).length === 0 ? error.message : "";
    return { ...placed, step: "account", accountErrors, statusMessage };
  }
  if (apiStep === "site") {
    if (fields.siteName) return { ...placed, step: "site-name", siteNameError: fields.siteName };
    return { ...placed, step: "site-type", statusMessage: fields.siteType ?? error.message };
  }
  return undefined;
}

function databaseMessages(database: ReturnType<typeof placeDatabaseProblem>) {
  return { connectionErrors: database.errors, statusMessage: database.statusMessage };
}

/** The API's field messages for the account, or the message placed by what it talks about. */
function accountMessages(fields: Readonly<Record<string, string>>, message: string) {
  const errors: AccountProblems = {};
  for (const field of ["name", "email", "password"] as const) {
    if (fields[field]) errors[field] = fields[field];
  }
  if (Object.keys(errors).length > 0) return errors;
  const field = fieldForAccountMessage(message);
  return field ? { [field]: message } : {};
}
