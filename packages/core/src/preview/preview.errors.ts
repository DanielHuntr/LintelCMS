import { HttpError } from "../http/http-errors.js";

/** The token wasn't made by this Lintel, or was changed on the way. */
export class PreviewTokenInvalidError extends HttpError {
  constructor() {
    super(
      401,
      "PREVIEW_TOKEN_INVALID",
      "This preview link isn't valid. Open the preview again from the editor in Lintel.",
    );
  }
}

/** Tokens last half an hour; the admin fetches a fresh one while the editor is open. */
export class PreviewTokenExpiredError extends HttpError {
  constructor() {
    super(
      401,
      "PREVIEW_TOKEN_EXPIRED",
      "This preview link has expired. Open the preview again from the editor in Lintel.",
    );
  }
}
