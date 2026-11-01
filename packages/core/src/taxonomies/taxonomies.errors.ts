import { HttpError } from "../http/http-errors.js";

export class TaxonomyNotFoundError extends HttpError {
  constructor(handle: string) {
    super(404, "NOT_FOUND", `There is no taxonomy with the handle "${handle}".`);
  }
}

export class TaxonomyHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(
      409,
      "TAXONOMY_HANDLE_TAKEN",
      `There is already a taxonomy with the handle "${handle}". Pick another handle.`,
    );
  }
}

export class TaxonomyInUseError extends HttpError {
  constructor(name: string, usedBy: readonly string[]) {
    super(
      409,
      "TAXONOMY_IN_USE",
      `${name} is used by fields in ${usedBy.join(", ")}. Remove those fields first.`,
      { usedBy },
    );
  }
}

export class TermNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That term doesn't exist. It may have been deleted.");
  }
}
