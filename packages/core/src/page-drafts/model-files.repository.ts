import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import type { WritingModel, WritingModelFile } from "./writing-model.js";

/**
 * The writing model's files on this server's disk, and nothing else: where they go, how much
 * of each is there, checking a file against its checksum, and removing them. Files being
 * downloaded end in ".part" until they are whole and checked.
 *
 * Checking 4.7 GB takes a while, so once every file has passed, a small "checked.json" says
 * so (with the sizes and checksums it passed with) and status reads that instead.
 */
export class ModelFiles {
  constructor(
    readonly modelsFolder: string,
    readonly model: WritingModel,
  ) {}

  get folder(): string {
    return join(this.modelsFolder, this.model.id);
  }

  pathOf(file: WritingModelFile): string {
    return join(this.folder, file.name);
  }

  partPathOf(file: WritingModelFile): string {
    return `${this.pathOf(file)}.part`;
  }

  /** The file llama.cpp is given; it finds the other parts beside it. */
  get modelPath(): string {
    return this.pathOf(this.model.files[0] as WritingModelFile);
  }

  private get checkedRecord(): string {
    return join(this.folder, "checked.json");
  }

  async ensureFolder(): Promise<void> {
    await mkdir(this.folder, { recursive: true });
  }

  /** Bytes on disk for a file: whole, or the part downloaded so far. */
  async bytesOnDisk(file: WritingModelFile): Promise<{ whole: number; part: number }> {
    return { whole: await sizeOf(this.pathOf(file)), part: await sizeOf(this.partPathOf(file)) };
  }

  /** Every file is whole, the right size, and passed its checksum. */
  async isInstalled(): Promise<boolean> {
    let record: unknown;
    try {
      record = JSON.parse(await readFile(this.checkedRecord, "utf8"));
    } catch {
      return false;
    }
    const passed = Array.isArray(record) ? record : [];
    for (const file of this.model.files) {
      const entry = passed.find(
        (item: { name?: string; sha256?: string }) =>
          item.name === file.name && item.sha256 === file.sha256,
      );
      if (!entry || (await sizeOf(this.pathOf(file))) !== file.sizeInBytes) return false;
    }
    return true;
  }

  async recordChecked(): Promise<void> {
    const passed = this.model.files.map(({ name, sha256 }) => ({ name, sha256 }));
    await writeFile(this.checkedRecord, `${JSON.stringify(passed, null, 2)}\n`);
  }

  async forgetChecked(): Promise<void> {
    await rm(this.checkedRecord, { force: true });
  }

  /** The SHA-256 of a file on disk, read in a stream so memory stays small. */
  async checksumOf(path: string): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    return hash.digest("hex");
  }

  async finishPart(file: WritingModelFile): Promise<void> {
    await rename(this.partPathOf(file), this.pathOf(file));
  }

  async removePart(file: WritingModelFile): Promise<void> {
    await rm(this.partPathOf(file), { force: true });
  }

  async removeFile(file: WritingModelFile): Promise<void> {
    await rm(this.pathOf(file), { force: true });
  }

  /** Removes the model's whole folder: files, parts and the checked record. */
  async removeAll(): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }

  /** Free space on the disk the models folder is on (or would be on). */
  async freeDiskBytes(): Promise<number> {
    let path = this.modelsFolder;
    for (;;) {
      try {
        const disk = await statfs(path);
        return disk.bavail * disk.bsize;
      } catch {
        const parent = dirname(path);
        if (parent === path) return 0;
        path = parent;
      }
    }
  }
}

async function sizeOf(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}
