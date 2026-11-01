import { HttpError } from "../../http/http-errors.js";

/** A file that isn't the Shopify export it should be, or can't be read. */
export class ImportFileError extends HttpError {
  constructor(file: "productsCsv" | "customersCsv" | "ordersCsv", message: string) {
    super(400, "IMPORT_FILE_INVALID", message, { fields: { [file]: message } });
  }
}

export class ImportBusyError extends HttpError {
  constructor() {
    super(
      409,
      "IMPORT_BUSY",
      "This import is already running in another window. Close one of them, or wait a minute.",
    );
  }
}

export class ImportAlreadyStartedError extends HttpError {
  constructor() {
    super(409, "IMPORT_STARTED", "This import has started, so its choices can't be changed now.");
  }
}
