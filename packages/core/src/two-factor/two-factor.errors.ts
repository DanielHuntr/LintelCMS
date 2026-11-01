import { HttpError } from "../http/http-errors.js";

export class InvalidTwoFactorCodeError extends HttpError {
  constructor() {
    super(
      401,
      "INVALID_TWO_FACTOR_CODE",
      "That code didn't work. Check the code in your authenticator app and try again.",
    );
  }
}

export class TwoFactorNotStartedError extends HttpError {
  constructor() {
    super(409, "TWO_FACTOR_NOT_STARTED", "Start setting up two-factor authentication first.");
  }
}

export class TwoFactorNotEnabledError extends HttpError {
  constructor() {
    super(409, "TWO_FACTOR_NOT_ENABLED", "Two-factor authentication isn't turned on.");
  }
}

export class TwoFactorRequiredByRoleError extends HttpError {
  constructor() {
    super(
      409,
      "TWO_FACTOR_REQUIRED",
      "Your role requires two-factor authentication, so it can't be turned off.",
    );
  }
}

export class TwoFactorSetupRequiredError extends HttpError {
  constructor() {
    super(
      403,
      "TWO_FACTOR_SETUP_REQUIRED",
      "Your role requires two-factor authentication. Turn it on in your account to continue.",
    );
  }
}

export class WrongPasswordError extends HttpError {
  constructor() {
    super(401, "WRONG_PASSWORD", "That isn't your current password.");
  }
}
