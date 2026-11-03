import { HttpError } from "../http/http-errors.js";

/** A downloaded or copied-in file isn't the one the model's makers published. */
export class ModelChecksumMismatchError extends HttpError {
  constructor(fileName: string) {
    super(
      422,
      "MODEL_CHECKSUM_MISMATCH",
      `${fileName} isn't the file the model's makers published (its checksum doesn't match), so it was deleted. Download it again.`,
    );
  }
}

export class ModelDownloadFailedError extends HttpError {
  constructor(reason: string) {
    super(502, "MODEL_DOWNLOAD_FAILED", `The download stopped: ${reason}. Try again in a while.`);
  }
}

export class ModelNotInstalledError extends HttpError {
  constructor() {
    super(
      409,
      "MODEL_NOT_INSTALLED",
      "The writing model isn't set up yet. An admin can set it up in Settings → Page drafting.",
    );
  }
}

/** Downloading, checking or removing is already under way. */
export class ModelBusyError extends HttpError {
  constructor() {
    super(
      409,
      "MODEL_BUSY",
      "The writing model is being downloaded or checked. Wait for it to finish.",
    );
  }
}

export class NotEnoughDiskError extends HttpError {
  constructor(neededBytes: number, freeBytes: number) {
    super(
      507,
      "NOT_ENOUGH_DISK",
      `This server needs ${gigabytes(neededBytes)} of free disk space for the model, and has ${gigabytes(freeBytes)}. Free some space, or skip page drafting on this server.`,
    );
  }
}

export class NotEnoughMemoryError extends HttpError {
  constructor(neededBytes: number, freeBytes: number) {
    super(
      503,
      "NOT_ENOUGH_MEMORY",
      `Drafting needs about ${gigabytes(neededBytes)} of free memory, and this server has ${gigabytes(freeBytes)} free right now. Try again when it's less busy, or use a server with more memory.`,
    );
  }
}

/** One draft at a time per server: the model uses most of the processor while it writes. */
export class DraftingBusyError extends HttpError {
  constructor() {
    super(
      409,
      "DRAFTING_BUSY",
      "Someone on this site is drafting right now. Try again in a minute or two.",
    );
  }
}

export class DraftNotFoundError extends HttpError {
  constructor() {
    super(404, "DRAFT_NOT_FOUND", "That draft has finished or was never started.");
  }
}

export function gigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
