import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import {
  ArchiveHasTooManyFilesError,
  ArchiveTooLargeError,
  UnreadableArchiveError,
} from "./archives.errors.js";

/** How much an archive may unpack to, so a small upload can't fill the disk or memory. */
export interface ArchiveLimits {
  /** The most one file inside may be, in bytes. */
  maxFileBytes: number;
  /** The most all files together may be, in bytes. */
  maxTotalBytes: number;
  /** The most files it may hold. No limit when left out. */
  maxFiles?: number;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxFileBytes: 1024 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024 * 1024,
};

/**
 * Reads a .zip file by entry name. Nothing is ever unpacked to disk under a name taken from
 * the archive, so an entry called "../../etc/passwd" is only ever a key in a map.
 */
export class ZipArchiveReader {
  private constructor(
    private readonly zip: ZipFile,
    private readonly entries: Map<string, Entry>,
  ) {}

  static async open(
    path: string,
    limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
  ): Promise<ZipArchiveReader> {
    let zip: ZipFile;
    try {
      zip = await yauzl.openPromise(path, { lazyEntries: true, autoClose: false });
    } catch (error) {
      throw new UnreadableArchiveError(describeReason(error));
    }
    try {
      const entries = await readEntries(zip, limits);
      return new ZipArchiveReader(zip, entries);
    } catch (error) {
      zip.close();
      throw error;
    }
  }

  /** Every file's name, folders left out. */
  listNames(): string[] {
    return [...this.entries.keys()];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  sizeOf(name: string): number | undefined {
    return this.entries.get(name)?.uncompressedSize;
  }

  async openStream(name: string): Promise<Readable> {
    const entry = this.entries.get(name);
    if (!entry) {
      throw new UnreadableArchiveError(`${name} is missing from it`);
    }
    return this.zip.openReadStreamPromise(entry);
  }

  async readBuffer(name: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of await this.openStream(name)) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  async readJson(name: string): Promise<unknown> {
    const text = (await this.readBuffer(name)).toString("utf8");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new UnreadableArchiveError(`${name} inside it isn't valid JSON`);
    }
  }

  /** The SHA-256 of one entry, read as a stream. */
  async hashOf(name: string): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of await this.openStream(name)) {
      hash.update(chunk as Buffer);
    }
    return hash.digest("hex");
  }

  close(): void {
    this.zip.close();
  }
}

function readEntries(zip: ZipFile, limits: ArchiveLimits): Promise<Map<string, Entry>> {
  const entries = new Map<string, Entry>();
  let totalBytes = 0;

  return new Promise((resolve, reject) => {
    zip.on("entry", (entry: Entry) => {
      if (!entry.fileName.endsWith("/")) {
        totalBytes += entry.uncompressedSize;
        if (entry.uncompressedSize > limits.maxFileBytes || totalBytes > limits.maxTotalBytes) {
          reject(new ArchiveTooLargeError());
          return;
        }
        entries.set(entry.fileName, entry);
        if (limits.maxFiles !== undefined && entries.size > limits.maxFiles) {
          reject(new ArchiveHasTooManyFilesError(limits.maxFiles));
          return;
        }
      }
      zip.readEntry();
    });
    zip.on("end", () => resolve(entries));
    zip.on("error", (error: unknown) => reject(new UnreadableArchiveError(describeReason(error))));
    zip.readEntry();
  });
}

function describeReason(error: unknown): string {
  return error instanceof Error ? error.message : "it isn't a zip file";
}
