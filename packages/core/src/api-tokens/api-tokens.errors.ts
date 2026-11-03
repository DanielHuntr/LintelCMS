import { HttpError } from "../http/http-errors.js";

export class ApiTokenNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That API token doesn't exist. It may have been deleted already.");
  }
}

/** Sent for a token that is unknown or was deleted, so a guessed token learns nothing. */
export class InvalidApiTokenError extends HttpError {
  constructor() {
    super(
      401,
      "INVALID_API_TOKEN",
      "This API token isn't valid. It may have been deleted; ask an admin for a new one.",
    );
  }
}

export class ApiTokenRequiredError extends HttpError {
  constructor() {
    super(
      401,
      "API_TOKEN_REQUIRED",
      "This site's content API needs a token. Send one as “Authorization: Bearer <token>”; admins make them in Build → API access.",
    );
  }
}
