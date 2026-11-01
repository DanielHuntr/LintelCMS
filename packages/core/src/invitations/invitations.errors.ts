import { HttpError } from "../http/http-errors.js";

export class InvitationNotFoundError extends HttpError {
  constructor() {
    super(
      404,
      "NOT_FOUND",
      "That invitation doesn't exist. It may have been accepted or cancelled.",
    );
  }
}

export class InvitationLinkInvalidError extends HttpError {
  constructor() {
    super(
      400,
      "INVITATION_INVALID",
      "This invitation has expired or was cancelled. Ask the person who invited you to send a new one.",
    );
  }
}
