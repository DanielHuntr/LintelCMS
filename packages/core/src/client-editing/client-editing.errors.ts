import { HttpError } from "../http/http-errors.js";

/** A client's save changes the design: only the content their designer opened up may change. */
export class DesignChangeNotAllowedError extends HttpError {
  constructor(where: string) {
    super(
      403,
      "DESIGN_CHANGE_NOT_ALLOWED",
      `You can change the words, pictures and links your designer opened up, but not the design (${where}). Undo that change, or ask your designer.`,
      { where },
    );
  }
}

/** Clients' changes wait for approval on this site, so they can't put them live themselves. */
export class ReviewNeededError extends HttpError {
  constructor() {
    super(
      403,
      "REVIEW_NEEDED",
      "Your changes go to the site team before they go live. Use Send for review instead.",
    );
  }
}

export class ClientReviewNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That review doesn't exist.");
  }
}

export class ReviewAlreadyAnsweredError extends HttpError {
  constructor() {
    super(409, "REVIEW_ANSWERED", "Someone has already answered this review.");
  }
}

export class AlreadyWaitingForReviewError extends HttpError {
  constructor() {
    super(409, "ALREADY_WAITING", "These changes are already waiting for review.");
  }
}

export class ReviewNotNeededError extends HttpError {
  constructor() {
    super(400, "REVIEW_NOT_NEEDED", "Changes on this site go live when they're published.");
  }
}
