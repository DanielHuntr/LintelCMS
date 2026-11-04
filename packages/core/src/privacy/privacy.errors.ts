import { HttpError } from "../http/http-errors.js";

/** Part of what a plugin found was ticked, and it can only work on all of it. */
export class CantChooseRecordsError extends HttpError {
  constructor(sourceName: string) {
    super(
      409,
      "CANT_CHOOSE_RECORDS",
      `${sourceName} can't pick out single records. Tick everything it found, or none of it, and look through the rest by hand.`,
    );
  }
}

/** One kind of data couldn't be searched, exported or erased: say which, so it can be checked. */
export class PersonalDataSourceError extends HttpError {
  constructor(sourceName: string, cause: unknown) {
    super(
      500,
      "PERSONAL_DATA_SOURCE_FAILED",
      `Lintel couldn't finish with ${sourceName}, so the job stopped there. Anything before it is done. Try again, and if it happens again, check ${sourceName} by hand.`,
    );
    this.cause = cause;
  }
}
