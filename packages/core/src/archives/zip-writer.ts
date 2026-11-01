import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { PassThrough, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ZipFile } from "yazl";

/** One file inside an archive, as listed in its manifest. */
export interface ArchivedFile {
  path: string;
  size: number;
  sha256: string;
}

/**
 * Writes a .zip file to disk, one entry at a time, keeping a SHA-256 of every entry so
 * the archive's manifest can list them. Entries are streamed, so a media library much
 * bigger than the server's memory still fits.
 *
 * The archive is written beside its final name and renamed when finished, so a crash
 * half way never leaves something that looks like a complete backup.
 */
export class ZipArchiveWriter {
  private readonly zip = new ZipFile();
  private readonly files: ArchivedFile[] = [];
  private readonly temporaryPath: string;
  private readonly written: Promise<void>;
  private pendingEntry: Promise<void> = Promise.resolve();

  private constructor(private readonly finalPath: string) {
    this.temporaryPath = `${finalPath}.${process.pid}.${Date.now()}.writing`;
    this.written = pipeline(this.zip.outputStream, createWriteStream(this.temporaryPath));
    // Reported by finish(); without this an early failure would be "unhandled".
    this.written.catch(() => {});
  }

  static async create(path: string): Promise<ZipArchiveWriter> {
    await mkdir(dirname(path), { recursive: true });
    return new ZipArchiveWriter(path);
  }

  addBuffer(path: string, contents: Buffer): void {
    this.zip.addBuffer(contents, path);
    this.files.push({ path, size: contents.length, sha256: sha256Of(contents) });
  }

  addJson(path: string, value: unknown): void {
    this.addBuffer(path, Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
  }

  /** Adds a stream, waiting for it to be read in full so its hash is known. */
  async addStream(path: string, contents: Readable): Promise<void> {
    await this.pendingEntry;
    const hash = createHash("sha256");
    let size = 0;
    const counter = new PassThrough();
    counter.on("data", (chunk: Buffer) => {
      hash.update(chunk);
      size += chunk.length;
    });
    const finished = new Promise<void>((resolve, reject) => {
      counter.on("end", resolve);
      counter.on("error", reject);
      contents.on("error", reject);
    });
    this.zip.addReadStream(contents.pipe(counter), path);
    this.pendingEntry = finished.then(() => {
      this.files.push({ path, size, sha256: hash.digest("hex") });
    });
    await this.pendingEntry;
  }

  /** The files added so far, in order. */
  listFiles(): readonly ArchivedFile[] {
    return this.files;
  }

  /** Finishes the archive and moves it to its final name. Returns its size in bytes. */
  async finish(): Promise<number> {
    await this.pendingEntry;
    this.zip.end();
    await this.written;
    await rename(this.temporaryPath, this.finalPath);
    return (await stat(this.finalPath)).size;
  }

  /** Throws away an archive that couldn't be finished. */
  async abandon(): Promise<void> {
    this.zip.outputStream.unpipe();
    await rm(this.temporaryPath, { force: true });
  }
}

export function sha256Of(contents: Buffer | string): string {
  return createHash("sha256").update(contents).digest("hex");
}

/**
 * One checksum for a whole archive: the hash of every file's path and hash, in order.
 * Kept in the manifest, so changing, adding or removing any file shows up.
 */
export function checksumOfFiles(files: readonly ArchivedFile[]): string {
  return sha256Of(files.map((file) => `${file.path}\n${file.sha256}\n`).join(""));
}
