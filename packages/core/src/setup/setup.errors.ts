import type { DatabaseProblem } from "../database/database-errors.js";
import { HttpError } from "../http/http-errors.js";

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
