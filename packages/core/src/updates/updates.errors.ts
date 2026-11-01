import { HttpError } from "../http/http-errors.js";

export class OwnersOnlyError extends HttpError {
  constructor() {
    super(403, "OWNERS_ONLY", "Only an owner of this site can update Lintel or roll it back.");
  }
}

export class UpdateAlreadyRunningError extends HttpError {
  constructor() {
    super(409, "UPDATE_RUNNING", "An update is already under way. Wait for it to finish.");
  }
}

export class ReleaseNotAvailableError extends HttpError {
  constructor(version: string) {
    super(
      404,
      "RELEASE_NOT_AVAILABLE",
      `Lintel ${version} isn't one of the updates available. Check for updates and try again.`,
    );
  }
}

export class UpdateNeedsAnotherFirstError extends HttpError {
  constructor(version: string, minimumVersion: string) {
    super(
      409,
      "UPDATE_NEEDS_ANOTHER_FIRST",
      `Lintel ${version} needs Lintel ${minimumVersion} or newer first. Update to that one, then to ${version}.`,
    );
  }
}

export class OneClickNotAvailableError extends HttpError {
  constructor() {
    super(
      409,
      "ONE_CLICK_NOT_AVAILABLE",
      "This copy of Lintel can't update itself from the admin. Settings → Updates shows how to update it.",
    );
  }
}

export class VersionNotInstalledError extends HttpError {
  constructor(version: string) {
    super(404, "VERSION_NOT_INSTALLED", `Lintel ${version} isn't kept on this server any more.`);
  }
}

export class AlreadyRunningVersionError extends HttpError {
  constructor(version: string) {
    super(409, "ALREADY_RUNNING_VERSION", `Lintel ${version} is the version running now.`);
  }
}

export class UpdaterUnreachableError extends HttpError {
  constructor(reason: string) {
    super(
      502,
      "UPDATER_UNREACHABLE",
      `The lintel-updater service didn't take the update (${reason}). Check that it is running, or update with the two commands instead.`,
    );
  }
}
