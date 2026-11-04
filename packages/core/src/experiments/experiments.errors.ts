import { HttpError } from "../http/http-errors.js";

export class ExperimentNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That test doesn't exist. It may have been deleted.");
  }
}

export class VersionNotFoundError extends HttpError {
  constructor(version: string) {
    super(404, "NOT_FOUND", `This test has no version ${version.toUpperCase()}.`);
  }
}

export class PageHasOpenExperimentError extends HttpError {
  constructor() {
    super(
      409,
      "TEST_ALREADY_OPEN",
      "This page already has a test. Add another version to it, or end it first.",
    );
  }
}

export class NothingToTestError extends HttpError {
  constructor() {
    super(
      400,
      "NOTHING_TO_TEST",
      "This page has no design yet. Design the page first, then try another version of it.",
    );
  }
}

export class SectionNotFoundError extends HttpError {
  constructor() {
    super(
      400,
      "SECTION_NOT_FOUND",
      "That section isn't on the page any more. Choose a section at the top level of the page.",
    );
  }
}

export class TooManyVersionsError extends HttpError {
  constructor() {
    super(409, "TOO_MANY_VERSIONS", "A test can have at most three versions, original included.");
  }
}

export class ExperimentRunningError extends HttpError {
  constructor(action: string) {
    super(409, "TEST_RUNNING", `Pause the test before you ${action}.`);
  }
}

export class ExperimentEndedError extends HttpError {
  constructor() {
    super(409, "TEST_ENDED", "This test has ended. Start a new one to try something else.");
  }
}

export class ExperimentNotReadyError extends HttpError {
  constructor(missing: "goal" | "version") {
    super(
      400,
      "TEST_NOT_READY",
      missing === "goal"
        ? "Choose what counts as success before starting the test."
        : "Add another version before starting the test.",
    );
  }
}

export class SplitDoesNotMatchError extends HttpError {
  constructor(versions: number) {
    super(400, "INVALID_SPLIT", `Give each of the ${versions} versions a share of visitors.`);
  }
}

export class InvalidVersionDesignError extends HttpError {
  constructor(problem: string) {
    super(400, "INVALID_DESIGN", problem);
  }
}

export class MayNotPublishError extends HttpError {
  constructor() {
    super(
      403,
      "FORBIDDEN",
      "Making a version the page publishes it, and your role can't publish pages. Ask someone who can.",
    );
  }
}

/** Someone saved this version of a test after the person saving opened it. */
export class VersionChangedError extends HttpError {
  constructor(updatedAt: string) {
    super(
      409,
      "VERSION_CHANGED",
      "Someone else saved this version while you were working on it. Try again to save yours over theirs, or reload the page to see theirs.",
      { updatedAt },
    );
  }
}
