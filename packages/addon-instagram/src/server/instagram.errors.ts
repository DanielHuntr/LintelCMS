import { HttpError } from "@lintel/core/plugin";

export class InstagramNotConnectedError extends HttpError {
  constructor() {
    super(409, "INSTAGRAM_NOT_CONNECTED", "Connect an Instagram account first.");
  }
}

export class InstagramPostNotFoundError extends HttpError {
  constructor() {
    super(
      404,
      "NOT_FOUND",
      "That post isn't here any more. It may have been replaced by newer ones.",
    );
  }
}

/**
 * Instagram refused or couldn't be reached. A 4xx, so the admin shows the message, which is
 * plain words the site owner can act on.
 */
export class InstagramRequestError extends HttpError {
  constructor(message: string) {
    super(422, "INSTAGRAM_REQUEST_FAILED", message);
  }
}
