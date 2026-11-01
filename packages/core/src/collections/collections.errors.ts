import { HttpError } from "../http/http-errors.js";

export class CollectionNotFoundError extends HttpError {
  constructor(handle: string) {
    super(404, "NOT_FOUND", `There is no collection with the handle "${handle}".`);
  }
}

export class CollectionHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(
      409,
      "COLLECTION_HANDLE_TAKEN",
      `There is already a collection with the handle "${handle}". Pick another handle.`,
    );
  }
}

export class CollectionNotEmptyError extends HttpError {
  constructor(name: string, entryCount: number) {
    const entries = entryCount === 1 ? "1 entry" : `${entryCount} entries`;
    super(
      409,
      "COLLECTION_NOT_EMPTY",
      `${name} still has ${entries}. Delete them first, so nothing is lost by accident.`,
    );
  }
}
