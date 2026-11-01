import type { DatabaseProblem } from "../database/database-errors.js";
import { type FieldMessages, HttpError } from "../http/http-errors.js";
import type { SetupStep } from "./setup.schema.js";

export class SetupAlreadyDoneError extends HttpError {
  constructor() {
    super(409, "SETUP_ALREADY_DONE", "Lintel is already set up. Sign in instead.");
  }
}

/** Also a 409 with the same code: there is nothing for setup to choose. */
export class DatabaseSetByEnvironmentError extends HttpError {
  constructor() {
    super(
      409,
      "SETUP_ALREADY_DONE",
      "The database is set by DATABASE_URL on the server, so it can't be changed here.",
    );
  }
}

export class SetupCodeRequiredError extends HttpError {
  constructor() {
    super(
      403,
      "SETUP_CODE_REQUIRED",
      "Setting up from another computer needs the setup code. " +
        "You'll find it in the terminal where Lintel is running.",
    );
  }
}

export class SetupCodeInvalidError extends HttpError {
  constructor() {
    super(
      403,
      "SETUP_CODE_INVALID",
      "That setup code isn't right. Check the code in the terminal where Lintel is running.",
    );
  }
}

export class TooManySetupAttemptsError extends HttpError {
  constructor(retryAfter: string) {
    super(429, "TOO_MANY_SETUP_ATTEMPTS", `Too many attempts. Please try again in ${retryAfter}.`);
  }
}

const problemCodes: Record<DatabaseProblem, string> = {
  unreachable: "DATABASE_UNREACHABLE",
  "auth-failed": "DATABASE_AUTH_FAILED",
  "not-found": "DATABASE_NOT_FOUND",
  invalid: "DATABASE_INVALID",
};

/** The database couldn't be used; `message` says why in plain English. */
export class DatabaseCheckFailedError extends HttpError {
  constructor(problem: DatabaseProblem, message: string) {
    super(422, problemCodes[problem], message);
  }
}

/**
 * A problem with one step's answers when finishing setup: the original error's status, code
 * and message, plus `step` ("database", "account" or "site") so the admin can take the person
 * back to that step, and `fields` when the problem is about particular fields.
 */
export class SetupStepError extends HttpError {
  readonly step: SetupStep;

  constructor(step: SetupStep, cause: HttpError, fields?: FieldMessages) {
    const causeFields = cause.details?.fields;
    super(cause.statusCode, cause.code, cause.message, {
      ...cause.details,
      ...((fields ?? causeFields) ? { fields: fields ?? causeFields } : {}),
      step,
    });
    this.step = step;
  }
}

/**
 * Runs one step of finishing setup. A problem that belongs to the step (bad details, a
 * database that can't be used, a weak password) is labelled with it; "already set up" and
 * unexpected errors are thrown on unchanged.
 */
export async function duringStep<Result>(
  step: SetupStep,
  work: () => Result | Promise<Result>,
): Promise<Result> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError && !(error instanceof SetupAlreadyDoneError)) {
      throw new SetupStepError(step, error);
    }
    throw error;
  }
}
