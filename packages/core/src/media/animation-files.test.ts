import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { detectFileType, isDotLottie, isLottieJson, isRiveFile } from "./file-types.js";

/** Lottie and Rive files for the builder's animation elements, told apart by their bytes. */

// Lintel's own samples, from the motion package beside this one.
const samples = fileURLToPath(new URL("../../../motion/samples/", import.meta.url));
const lottieJson = readFileSync(join(samples, "sample-hop.json"));
const riveFile = readFileSync(join(samples, "sample-orbit.riv"));

/** A zip with these files, stored the way a .lottie is. */
function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const packed = deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(text.length, 22);
    local.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(text.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    const part = Buffer.concat([local, Buffer.from(name), packed]);
    locals.push(part);
    directory.push(Buffer.concat([entry, Buffer.from(name)]));
    offset += part.length;
  }
  const directoryBytes = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(directory.length, 8);
  end.writeUInt16LE(directory.length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directoryBytes, end]);
}

describe("animation files in the media library", () => {
  it("accepts a Lottie animation's JSON, whatever it is called", async () => {
    expect(await detectFileType(lottieJson, "hop.json")).toMatchObject({
      mimeType: "application/json",
      extension: "json",
      kind: "animation",
    });
    expect(isLottieJson(lottieJson.toString("utf8"))).toBe(true);
  });

  it("refuses JSON that isn't an animation", async () => {
    await expect(
      detectFileType(Buffer.from('{"name":"settings"}'), "settings.json"),
    ).rejects.toThrow();
    expect(isLottieJson("{not json")).toBe(false);
  });

  it("accepts a .lottie file, a zip with an animation in it", async () => {
    const dotLottie = zip({
      "manifest.json": JSON.stringify({ animations: [{ id: "hop" }] }),
      "animations/hop.json": lottieJson.toString("utf8"),
    });
    expect(isDotLottie(dotLottie)).toBe(true);
    expect(await detectFileType(dotLottie, "hop.lottie")).toMatchObject({
      extension: "lottie",
      kind: "animation",
    });
  });

  it("refuses an ordinary zip, even called .lottie", async () => {
    const plain = zip({ "notes.txt": "hello" });
    expect(isDotLottie(plain)).toBe(false);
    await expect(detectFileType(plain, "notes.lottie")).rejects.toThrow();
  });

  it("accepts a Rive file by its RIVE header", async () => {
    expect(isRiveFile(riveFile)).toBe(true);
    expect(await detectFileType(riveFile, "orbit.riv")).toMatchObject({
      mimeType: "application/x-rive",
      extension: "riv",
      kind: "animation",
    });
    expect(isRiveFile(Buffer.from("RIV"))).toBe(false);
  });
});
