import { HttpError } from "../http/http-errors.js";

/** Also used for drafts, so the response never reveals that an unpublished entry exists. */
export class PublishedEntryNotFoundError extends HttpError {
  constructor(slug: string) {
    super(404, "NOT_FOUND", `There is no published entry at "${slug}".`);
  }
}
