import { HttpError } from "../http/http-errors.js";

export class ResetLinkInvalidError extends HttpError {
  constructor() {
    super(
      400,
      "RESET_LINK_INVALID",
      "This reset link has expired or has already been used. Ask for a new one.",
    );
  }
}

export class TooManyResetRequestsError extends HttpError {
  constructor(retryAfter: string) {
    super(429, "TOO_MANY_REQUESTS", `Too many requests. Please try again in ${retryAfter}.`);
  }
}
