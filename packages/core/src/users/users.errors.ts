import { HttpError } from "../http/http-errors.js";

export class UserNotFoundHttpError extends HttpError {
  constructor() {
    super(
      404,
      "NOT_FOUND",
      "That person doesn't have an account here. They may have been removed.",
    );
  }
}

/** The site always keeps at least one active owner, so someone can always manage it. */
export class LastOwnerError extends HttpError {
  constructor(change: string) {
    super(
      409,
      "LAST_OWNER",
      `This is the only active owner, so you can't ${change}. Make someone else an owner first.`,
    );
  }
}

export class OwnersOnlyError extends HttpError {
  constructor() {
    super(403, "OWNERS_ONLY", "Only an owner can change another owner's account.");
  }
}

export class CannotChangeOwnAccountError extends HttpError {
  constructor(change: string) {
    super(409, "OWN_ACCOUNT", `You can't ${change} your own account. Ask another admin.`);
  }
}

export class InvalidReassignmentError extends HttpError {
  constructor() {
    super(
      400,
      "INVALID_REQUEST",
      "Their content has to go to someone else with an active account.",
    );
  }
}

export class EmailAlreadyUsedHttpError extends HttpError {
  constructor(email: string) {
    super(409, "EMAIL_ALREADY_USED", `There is already an account with the email ${email}.`);
  }
}

export class AvatarNotFoundError extends HttpError {
  constructor() {
    super(400, "INVALID_REQUEST", "That picture isn't in the media library, or isn't an image.");
  }
}
