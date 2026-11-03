import { HttpError } from "../http/http-errors.js";

export class SiteDesignChangedError extends HttpError {
  constructor() {
    super(
      409,
      "SITE_DESIGN_CHANGED",
      "Someone else changed the site's styles while you were working. Your last change wasn't saved.",
    );
  }
}
