import type { Readable } from "node:stream";

/**
 * Where uploaded files' bytes are kept. The database only stores each asset's `storageKey`,
 * so moving to S3, R2 or any other store means writing one more class with these four
 * methods and passing it to `buildServer` (see the README).
 *
 * Keys are made by Lintel (`<tenant>/<asset id>.<extension>`), never by whoever uploads.
 */
export interface StorageDriver {
  /** Saves the file, replacing anything already at `key`. */
  put(key: string, contents: Buffer, mimeType: string): Promise<void>;
  /** The file's bytes as a stream. Throws StoredFileMissingError if there is nothing at `key`. */
  get(key: string): Promise<Readable>;
  /** Removes the file. Deleting something that isn't there is not an error. */
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class StoredFileMissingError extends Error {
  constructor(key: string) {
    super(`No stored file at "${key}". It may have been removed from storage by hand.`);
    this.name = "StoredFileMissingError";
  }
}
