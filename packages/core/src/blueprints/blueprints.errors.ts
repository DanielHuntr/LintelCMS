import { HttpError } from "../http/http-errors.js";

export class BlueprintNotFoundError extends HttpError {
  constructor(handle: string) {
    super(404, "NOT_FOUND", `There is no content type with the handle "${handle}".`);
  }
}

export class BlueprintHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(
      409,
      "BLUEPRINT_HANDLE_TAKEN",
      `There is already a content type with the handle "${handle}". Pick another handle.`,
    );
  }
}

export class BlueprintInUseError extends HttpError {
  constructor(handle: string, collectionNames: readonly string[]) {
    super(
      409,
      "BLUEPRINT_IN_USE",
      `The content type "${handle}" is used by ${collectionNames.join(", ")}. ` +
        "Delete those collections or give them another content type first.",
    );
  }
}
