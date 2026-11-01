import { type FieldMessages, HttpError } from "../http/http-errors.js";

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

/**
 * Drafts may leave required fields empty; publishing and scheduling may not. Carries one
 * message per field, like a validation error, so the editor can point at each one.
 */
export class NotReadyToPublishError extends HttpError {
  readonly fields: FieldMessages;

  constructor(fields: FieldMessages) {
    super(400, "NOT_READY_TO_PUBLISH", "Fill in the required fields to publish.", { fields });
    this.fields = fields;
  }
}

export class SharedEntryCopyError extends HttpError {
  constructor(collectionName: string) {
    super(
      400,
      "INVALID_REQUEST",
      `${collectionName} is shared by every site, so its entries are already on all of them.`,
    );
  }
}

export class SameSiteCopyError extends HttpError {
  constructor(siteName: string) {
    super(400, "INVALID_REQUEST", `This entry is already on ${siteName}. Pick another site.`);
  }
}
