import { HttpError } from "../http/http-errors.js";

export class AnalyticsRangeTooLongError extends HttpError {
  constructor(maximumDays: number) {
    super(
      400,
      "RANGE_TOO_LONG",
      `Choose ${maximumDays} days or fewer. For a longer view, export each part as a spreadsheet.`,
    );
  }
}

export class AnalyticsRangeBackwardsError extends HttpError {
  constructor() {
    super(400, "RANGE_BACKWARDS", "The first day must come before the last day.");
  }
}
