import { HttpError } from "../http/http-errors.js";

export class EntryNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That entry doesn't exist. It may have been deleted.");
  }
}

export class RevisionNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That revision doesn't exist for this entry.");
  }
}

/** A parent that can't be used: wrong collection, the entry itself, or one of its children. */
export class InvalidParentError extends HttpError {
  constructor(reason: string) {
    super(400, "INVALID_REQUEST", reason);
  }
}

export class ReorderNotAllowedError extends HttpError {
  constructor(collectionName: string) {
    super(
      400,
      "INVALID_REQUEST",
      `${collectionName} is ordered by date, so its entries can't be put in order by hand.`,
    );
  }
}

export class ScheduleInPastError extends HttpError {
  constructor() {
    super(400, "INVALID_REQUEST", "Please pick a time in the future to publish at.");
  }
}

export class EntryNotInCollectionError extends HttpError {
  constructor(entryId: string, collectionName: string) {
    super(400, "INVALID_REQUEST", `The entry ${entryId} isn't in ${collectionName}.`);
  }
}

export class TranslationExistsError extends HttpError {
  constructor(localeName: string, translationId: string) {
    super(409, "TRANSLATION_EXISTS", `This entry already has a ${localeName} version.`, {
      translationId,
    });
  }
}

export class SameLocaleTranslationError extends HttpError {
  constructor(localeName: string) {
    super(400, "INVALID_REQUEST", `This entry is already written in ${localeName}.`);
  }
}
