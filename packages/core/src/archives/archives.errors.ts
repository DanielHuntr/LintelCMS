import { HttpError } from "../http/http-errors.js";

export class UnreadableArchiveError extends HttpError {
  constructor(reason: string) {
    super(
      400,
      "UNREADABLE_ARCHIVE",
      `This file can't be opened as a .zip archive (${reason}). It may be damaged or only partly downloaded.`,
    );
  }
}

export class ArchiveTooLargeError extends HttpError {
  constructor() {
    super(
      400,
      "ARCHIVE_TOO_LARGE",
      "This .zip file unpacks to more than Lintel accepts. Split it into smaller archives and try again.",
    );
  }
}

export class ArchiveHasTooManyFilesError extends HttpError {
  constructor(limit: number) {
    super(
      400,
      "ARCHIVE_HAS_TOO_MANY_FILES",
      `This .zip file holds more than ${limit.toLocaleString("en")} files, the most Lintel accepts here. Leave out anything the import doesn't need, such as old backups, and try again.`,
    );
  }
}
