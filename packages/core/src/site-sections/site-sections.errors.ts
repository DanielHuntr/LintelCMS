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
