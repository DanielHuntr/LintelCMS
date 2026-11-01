import { HttpError } from "../http/http-errors.js";

export class SiteNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That site doesn't exist. It may have been removed.");
  }
}

/** Sorting named an entry that isn't one of the children being sorted. */
export class EntryNotAtThisPlaceError extends HttpError {
  constructor(entryId: string) {
    super(400, "INVALID_REQUEST", `The entry ${entryId} isn't one of the items being sorted.`);
  }
}
