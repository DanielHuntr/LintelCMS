import { HttpError } from "../http/http-errors.js";

export class FormNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That form doesn't exist. It may have been deleted or renamed.");
  }
}

export class FormHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(
      409,
      "HANDLE_TAKEN",
      `Another form already uses the handle "${handle}". Choose a different one.`,
    );
  }
}

export class SubmissionNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That submission doesn't exist. It may have been deleted.");
  }
}

export class FormClosedError extends HttpError {
  constructor() {
    super(403, "FORM_CLOSED", "This form isn't taking submissions at the moment.");
  }
}

/** The signed "opened at" token is missing, altered, or older than a day. */
export class FormExpiredError extends HttpError {
  constructor() {
    super(
      400,
      "FORM_EXPIRED",
      "This form has expired. Reload the page and try again; your answers may need filling in again.",
    );
  }
}

export class TurnstileFailedError extends HttpError {
  constructor() {
    super(
      400,
      "TURNSTILE_FAILED",
      "We couldn't confirm you're a person rather than a robot. Please complete the check and send the form again.",
    );
  }
}

export class TooManySubmissionsError extends HttpError {
  constructor(after: string) {
    super(
      429,
      "TOO_MANY_SUBMISSIONS",
      `That's a lot of submissions from one place. Please wait ${after} and try again.`,
    );
  }
}
