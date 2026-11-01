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
