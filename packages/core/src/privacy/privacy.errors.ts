import { HttpError } from "../http/http-errors.js";

/** One kind of data couldn't be searched, exported or erased: say which, so it can be checked. */
export class PersonalDataSourceError extends HttpError {
  constructor(sourceName: string, cause: unknown) {
    super(
      500,
      "PERSONAL_DATA_SOURCE_FAILED",
      `Lintel couldn't finish with ${sourceName}. Nothing after it was changed. Try again, and if it happens again, check ${sourceName} by hand.`,
    );
    this.cause = cause;
  }
}
