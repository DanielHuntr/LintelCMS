import { HttpError } from "../http/http-errors.js";
import type { ImportSource } from "./site-import.schema.js";

const sourceNames: Record<ImportSource, string> = {
  webflow: "Webflow",
  framer: "Framer",
  statamic: "Statamic",
  umbraco: "Umbraco",
};

export function sourceName(source: ImportSource): string {
  return sourceNames[source];
}

/** The files given aren't what the importer for that system reads. */
export class NotAnExportError extends HttpError {
  constructor(source: ImportSource, reason: string) {
    super(
      400,
      "NOT_AN_EXPORT",
      `These files don't look like a ${sourceNames[source]} export: ${reason}.`,
    );
  }
}

export class SiteImportNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "There is no import with that id. It may have been deleted.");
  }
}

export class SiteImportBusyError extends HttpError {
  constructor() {
    super(409, "IMPORT_RUNNING", "This import is running. Wait for it to finish or pause.");
  }
}

export class SiteImportFinishedError extends HttpError {
  constructor() {
    super(
      409,
      "IMPORT_FINISHED",
      "This import has finished. Upload the files again to import them once more.",
    );
  }
}
