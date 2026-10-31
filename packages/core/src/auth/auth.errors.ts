import { HttpError } from "../http/http-errors.js";

/**
 * Wrong email and wrong password share one error with one message, so the response
 * can't be used to find out who has an account.
 */
export class SignInFailedError extends HttpError {
  constructor() {
    super(401, "SIGN_IN_FAILED", "That email and password don't match");
  }
}

export class NotSignedInError extends HttpError {
  constructor() {
    super(401, "NOT_SIGNED_IN", "Please sign in to continue");
  }
}

export class PermissionDeniedError extends HttpError {
  constructor(permission: string) {
    super(
      403,
      "PERMISSION_DENIED",
      `You don't have permission to do that (it needs "${permission}"). Ask an admin if you need it.`,
    );
  }
}

export class TooManySignInAttemptsError extends HttpError {
  constructor(retryAfter: string) {
    super(
      429,
      "TOO_MANY_SIGN_IN_ATTEMPTS",
      `Too many sign-in attempts. Please try again in ${retryAfter}.`,
    );
  }
}
