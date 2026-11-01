import { HttpError } from "../http/http-errors.js";
import type { PasswordTip } from "./password-strength.js";

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

const weakPasswordAdvice: Record<PasswordTip, string> = {
  "avoid-personal-details": "Leave out your name and email.",
  "avoid-common-passwords": "It's close to a password many people use.",
  "avoid-keyboard-patterns": "Avoid rows of keys like qwerty.",
  "avoid-repeats": "Avoid repeated letters or words.",
  "avoid-sequences": "Avoid sequences like abc or 123.",
  "avoid-dates": "Avoid dates and years.",
  "use-more-characters": "Use at least 12 characters.",
  "add-another-word": "Add another word or two.",
};

/**
 * A new password that is long enough but easy to guess (see password-strength.ts). The same
 * 400 INVALID_REQUEST as other bad details, with `fields.password`, so the admin can show it
 * under the password field.
 */
export class WeakPasswordError extends HttpError {
  constructor(tip: PasswordTip | undefined) {
    const advice = tip ? ` ${weakPasswordAdvice[tip]}` : "";
    const message = `That password would be too easy to guess.${advice}`;
    super(400, "INVALID_REQUEST", message, { fields: { password: message } });
  }
}

/** Only said after the right password, so it reveals nothing to someone guessing. */
export class AccountDeactivatedError extends HttpError {
  constructor() {
    super(
      403,
      "ACCOUNT_DEACTIVATED",
      "Your account has been deactivated. Ask an admin if you need it back.",
    );
  }
}

export class SignInExpiredError extends HttpError {
  constructor() {
    super(
      401,
      "SIGN_IN_EXPIRED",
      "That took too long, or too many codes were tried. Please sign in again.",
    );
  }
}
