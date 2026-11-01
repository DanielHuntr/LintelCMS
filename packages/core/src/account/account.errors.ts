import { HttpError } from "../http/http-errors.js";

export class EmailLinkInvalidError extends HttpError {
  constructor() {
    super(
      400,
      "EMAIL_LINK_INVALID",
      "This link has expired or has already been used. Change your email again from your account.",
    );
  }
}

export class SessionNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That device is already signed out.");
  }
}

export class SameEmailError extends HttpError {
  constructor() {
    super(400, "INVALID_REQUEST", "That is already your email address.");
  }
}
