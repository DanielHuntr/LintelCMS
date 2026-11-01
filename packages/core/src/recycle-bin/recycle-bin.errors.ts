import { HttpError } from "../http/http-errors.js";

export class RecycleBinItemNotFoundError extends HttpError {
  constructor() {
    super(
      404,
      "NOT_FOUND",
      "That item isn't in the recycle bin. It may have been restored or emptied.",
    );
  }
}

/** The content type of something in the bin was deleted since, so there's nowhere to put it. */
export class CollectionGoneError extends HttpError {
  constructor(title: string) {
    super(
      409,
      "COLLECTION_GONE",
      `“${title}” can't be restored because its content type has been deleted.`,
    );
  }
}
