import { HttpError } from "../http/http-errors.js";

/** One or more content model files can't be used. Each problem names its file. */
export class ContentModelProblemsError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `The content model files have ${problems.length === 1 ? "a problem" : `${problems.length} problems`}:\n` +
        problems.map((problem) => `  - ${problem}`).join("\n"),
    );
    this.name = "ContentModelProblemsError";
  }
}

/** A content model file couldn't be read at all, such as a TypeScript syntax error. */
export class ContentModelFileUnreadableError extends ContentModelProblemsError {
  constructor(source: string, reason: string) {
    super([`${source} can't be read: ${reason}`]);
    this.name = "ContentModelFileUnreadableError";
  }
}

/** Schema editing in the admin is switched off because the files are the source of truth. */
export class ContentModelManagedInCodeError extends HttpError {
  constructor(folder: string) {
    super(
      409,
      "CONTENT_MODEL_MANAGED_IN_CODE",
      `Content types, taxonomies, global sets and menus on this site are managed in code, in the ` +
        `${folder} folder, so they can't be changed here. Ask your developer to make the change ` +
        "in those files and deploy it.",
    );
  }
}

/** The changes waiting for a confirmation are gone, or different from what was shown. */
export class NoPendingModelChangesError extends HttpError {
  constructor() {
    super(
      409,
      "NO_PENDING_MODEL_CHANGES",
      "There are no content model changes waiting to be confirmed. Reload to see the latest.",
    );
  }
}
