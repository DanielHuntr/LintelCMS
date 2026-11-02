import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZipArchiveReader } from "./zip-reader.js";
import { ZipArchiveWriter } from "./zip-writer.js";

describe("zip archive writer", () => {
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-zip-"));
  });

  afterEach(() => rm(folder, { recursive: true, force: true }));

  it("writes every byte of a streamed file, as the manifest says", async () => {
    // Bigger than one read chunk, so a stream that starts flowing early would lose data.
    const picture = randomBytes(200_000);
    const picturePath = join(folder, "picture.png");
    await writeFile(picturePath, picture);
    const archivePath = join(folder, "archive.zip");

    const writer = await ZipArchiveWriter.create(archivePath);
    writer.addJson("first.json", { hello: "world" });
    await writer.addStream("media/picture.png", createReadStream(picturePath));
    await writer.addStream("media/small.txt", Readable.from([Buffer.from("small file")]));
    await writer.finish();

    const reader = await ZipArchiveReader.open(archivePath);
    try {
      expect((await reader.readBuffer("media/picture.png")).equals(picture)).toBe(true);
      expect((await reader.readBuffer("media/small.txt")).toString()).toBe("small file");
      const listed = writer.listFiles().find((file) => file.path === "media/picture.png");
      expect(listed?.size).toBe(picture.length);
      expect(listed?.sha256).toBe(createHash("sha256").update(picture).digest("hex"));
      expect(reader.sizeOf("media/picture.png")).toBe(picture.length);
    } finally {
      reader.close();
    }
  });
});
