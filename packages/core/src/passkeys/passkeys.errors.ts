import { HttpError } from "../http/http-errors.js";

export class PasskeyNotRecognisedError extends HttpError {
  constructor() {
    super(
      401,
      "PASSKEY_NOT_RECOGNISED",
      "That passkey isn't set up for this site. Sign in with your password instead.",
    );
  }
}

export class PasskeyRegistrationFailedError extends HttpError {
  constructor() {
    super(
      400,
      "PASSKEY_NOT_SAVED",
      "The passkey couldn't be checked, so it wasn't saved. Please try again.",
    );
  }
}

export class PasskeyNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That passkey doesn't exist. It may have been removed already.");
  }
}
