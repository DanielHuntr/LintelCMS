import { HttpError } from "../http/http-errors.js";

export class FieldsetNotFoundError extends HttpError {
  constructor(handle: string) {
    super(404, "NOT_FOUND", `There is no fieldset with the handle "${handle}".`);
  }
}

export class FieldsetHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(
      409,
      "FIELDSET_HANDLE_TAKEN",
      `There is already a fieldset with the handle "${handle}". Pick another handle.`,
    );
  }
}

export class FieldsetInUseError extends HttpError {
  constructor(handle: string, usedBy: readonly string[]) {
    super(
      409,
      "FIELDSET_IN_USE",
      `The fieldset "${handle}" is used by ${usedBy.join(", ")}. Remove it from there first.`,
    );
  }
}
