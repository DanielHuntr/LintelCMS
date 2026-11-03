import { HttpError, InvalidFieldsError } from "../http/http-errors.js";

export class SiteSectionNotValidError extends InvalidFieldsError {
  constructor(slot: string, problem: string) {
    super({ [slot]: problem });
  }
}

export class SiteSectionCodeNotAllowedError extends HttpError {
  constructor() {
    super(
      403,
      "CODE_NOT_ALLOWED",
      "Only people allowed to edit code can add or change code. Ask a developer, or undo the change.",
    );
  }
}

export class NoPreviousSiteSectionsError extends HttpError {
  constructor() {
    super(
      404,
      "NO_PREVIOUS_SECTIONS",
      "There is no earlier navigation and footer to bring back on this site.",
    );
  }
}
