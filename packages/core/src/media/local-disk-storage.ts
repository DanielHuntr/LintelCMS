import { createReadStream } from "node:fs";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { type StorageDriver, StoredFileMissingError } from "./storage-driver.js";

/** `.lintel/uploads` at the repository root (already gitignored); the same from `src` and `dist`. */
export const DEFAULT_UPLOADS_FOLDER = fileURLToPath(
  new URL("../../../../.lintel/uploads", import.meta.url),
);

/** Keeps files in a folder on this computer. The default, and what tests use with a temporary folder. */
export class LocalDiskStorage implements StorageDriver {
  private readonly rootFolder: string;

  constructor(rootFolder: string = DEFAULT_UPLOADS_FOLDER) {
    this.rootFolder = resolve(rootFolder);
  }

  async put(key: string, contents: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    // Written beside the final name and then renamed, so a reader never sees half a file.
    const temporaryPath = `${path}.${process.pid}.${Date.now()}.uploading`;
    await writeFile(temporaryPath, contents);
    await rename(temporaryPath, path);
  }

  async get(key: string): Promise<Readable> {
    const path = this.pathFor(key);
    if (!(await this.exists(key))) {
      throw new StoredFileMissingError(key);
    }
    return createReadStream(path);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  /** Keys come from Lintel, but a key that climbs out of the folder is refused all the same. */
  private pathFor(key: string): string {
    const path = resolve(join(this.rootFolder, key));
    if (!path.startsWith(this.rootFolder + sep)) {
      throw new Error(`Storage key "${key}" points outside the uploads folder.`);
    }
    return path;
  }
}
