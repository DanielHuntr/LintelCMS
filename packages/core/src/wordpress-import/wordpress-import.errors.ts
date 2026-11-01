import { HttpError } from "../http/http-errors.js";

export class NotAWordPressExportError extends HttpError {
  constructor(reason: string) {
    super(
      400,
      "NOT_A_WORDPRESS_EXPORT",
      `This file isn't a WordPress export: ${reason}. In WordPress, go to Tools → Export, choose "All content" and upload the .xml file it gives you.`,
    );
  }
}

export class WordPressImportNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That import doesn't exist. It may have been deleted.");
  }
}

export class WordPressImportBusyError extends HttpError {
  constructor() {
    super(409, "IMPORT_RUNNING", "This import is already running. Wait for it to finish.");
  }
}

export class WordPressImportFinishedError extends HttpError {
  constructor() {
    super(
      409,
      "IMPORT_FINISHED",
      "This import has finished. Upload the file again to import it once more.",
    );
  }
}

export class MediaNotAllowedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "MediaNotAllowedError";
  }
}
