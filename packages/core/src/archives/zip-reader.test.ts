import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import yazl from "yazl";
import { ZipArchiveReader } from "./zip-reader.js";

describe("zip archive reader", () => {
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-zip-reader-"));
  });
  afterEach(() => rm(folder, { recursive: true, force: true }));

  async function writeZip(name: string, contents: string): Promise<string> {
    const path = join(folder, "archive.zip");
    const zip = new yazl.ZipFile();
    zip.addBuffer(Buffer.from(contents), name, { compress: true });
    zip.end();
    await pipeline(zip.outputStream, createWriteStream(path));
    return path;
  }

  // LINTEL-FUNC-011: damage inside an entry's compressed data came back as a server error.
  it("reports damaged compressed data as an unreadable archive", async () => {
    const words = randomBytes(20_000).toString("hex");
    const path = await writeZip("content.json", JSON.stringify({ words }));
    const bytes = await readFile(path);
    // Well inside the entry's compressed data, clear of its header and the archive's index.
    const damageStart = 2_000;
    for (let index = damageStart; index < damageStart + 60; index += 1) {
      bytes[index] = (bytes[index] ?? 0) ^ 0xff;
    }
    await writeFile(path, bytes);

    const reader = await ZipArchiveReader.open(path);
    try {
      await expect(reader.readJson("content.json")).rejects.toMatchObject({
        statusCode: 400,
        code: "UNREADABLE_ARCHIVE",
      });
      await expect(reader.hashOf("content.json")).rejects.toMatchObject({
        code: "UNREADABLE_ARCHIVE",
      });
    } finally {
      reader.close();
    }
  });

  it("reads an undamaged entry", async () => {
    const reader = await ZipArchiveReader.open(await writeZip("a.json", '{"ok":true}'));
    try {
      expect(await reader.readJson("a.json")).toEqual({ ok: true });
    } finally {
      reader.close();
    }
  });
});
