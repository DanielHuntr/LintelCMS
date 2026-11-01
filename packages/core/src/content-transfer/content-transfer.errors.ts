import { HttpError } from "../http/http-errors.js";

export class NotAnExportError extends HttpError {
  constructor(reason: string) {
    super(400, "NOT_AN_EXPORT", `This file isn't a Lintel export: ${reason}.`);
  }
}

export class ImportUploadNotFoundError extends HttpError {
  constructor() {
    super(
      404,
      "NOT_FOUND",
      "That upload has expired or was already imported. Upload the file again.",
    );
  }
}
