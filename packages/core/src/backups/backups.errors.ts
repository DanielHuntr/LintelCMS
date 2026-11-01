import { HttpError } from "../http/http-errors.js";

export class BackupNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That backup doesn't exist. It may have been deleted.");
  }
}

export class BackupFileMissingError extends HttpError {
  constructor(filename: string) {
    super(
      410,
      "BACKUP_FILE_MISSING",
      `The file ${filename} is no longer in the backups folder, so this backup can't be used. It may have been moved or deleted by hand.`,
    );
  }
}

export class BackupNotReadyError extends HttpError {
  constructor() {
    super(409, "BACKUP_NOT_READY", "This backup isn't finished, so it can't be used yet.");
  }
}

export class NotABackupError extends HttpError {
  constructor(reason: string) {
    super(400, "NOT_A_BACKUP", `This file isn't a Lintel backup: ${reason}.`);
  }
}

/** A file inside the archive doesn't match the manifest: it was damaged or changed. */
export class BackupDamagedError extends HttpError {
  constructor(path: string) {
    super(
      400,
      "BACKUP_DAMAGED",
      `This backup is damaged: ${path} isn't what it was when the backup was made. Nothing was changed. Try another copy of the backup.`,
    );
  }
}

export class BackupFromNewerLintelError extends HttpError {
  constructor() {
    super(
      400,
      "BACKUP_FROM_NEWER_LINTEL",
      "This backup was made by a newer version of Lintel. Update Lintel here first, then restore it.",
    );
  }
}

export class RestoreInProgressError extends HttpError {
  constructor() {
    super(409, "RESTORE_IN_PROGRESS", "A restore is already running. Wait for it to finish.");
  }
}
