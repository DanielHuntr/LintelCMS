import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readFontFileDetails } from "./font-file-names.js";
import { createFontNetwork } from "./font-network.js";

/** A `name` table with Windows (UTF-16) names: id 1 and 2, and optionally 16 and 17. */
function nameTable(names: Record<number, string>): Buffer {
  const entries = Object.entries(names).map(([id, text]) => {
    const bytes = Buffer.from(text, "utf16le");
    bytes.swap16();
    return { id: Number(id), bytes };
  });
  const header = Buffer.alloc(6 + entries.length * 12);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(entries.length, 2);
  header.writeUInt16BE(header.length, 4);
  let offset = 0;
  entries.forEach((entry, index) => {
    const record = 6 + index * 12;
    header.writeUInt16BE(3, record);
    header.writeUInt16BE(1, record + 2);
    header.writeUInt16BE(0x0409, record + 4);
    header.writeUInt16BE(entry.id, record + 6);
    header.writeUInt16BE(entry.bytes.length, record + 8);
    header.writeUInt16BE(offset, record + 10);
    offset += entry.bytes.length;
  });
  return Buffer.concat([header, ...entries.map((entry) => entry.bytes)]);
}

function os2Table(weight: number, italic: boolean): Buffer {
  const table = Buffer.alloc(78);
  table.writeUInt16BE(weight, 4);
  table.writeUInt16BE(italic ? 1 : 0x40, 62);
  return table;
}

/** A TTF with just the two tables that are read. */
function sfnt(tables: Record<string, Buffer>): Buffer {
  const tags = Object.keys(tables);
  const directory = Buffer.alloc(12 + tags.length * 16);
  directory.writeUInt32BE(0x00010000, 0);
  directory.writeUInt16BE(tags.length, 4);
  let offset = directory.length;
  tags.forEach((tag, index) => {
    const entry = 12 + index * 16;
    directory.write(tag, entry, "latin1");
    directory.writeUInt32BE(offset, entry + 8);
    directory.writeUInt32BE(tables[tag]?.length ?? 0, entry + 12);
    offset += tables[tag]?.length ?? 0;
  });
  return Buffer.concat([directory, ...tags.map((tag) => tables[tag] ?? Buffer.alloc(0))]);
}

/** The same tables as WOFF, each compressed with zlib. */
function woff(tables: Record<string, Buffer>): Buffer {
  const tags = Object.keys(tables);
  const header = Buffer.alloc(44 + tags.length * 20);
  header.write("wOFF", 0, "latin1");
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt16BE(tags.length, 12);
  const bodies: Buffer[] = [];
  let offset = header.length;
  tags.forEach((tag, index) => {
    const original = tables[tag] ?? Buffer.alloc(0);
    const compressed = deflateSync(original);
    const entry = 44 + index * 20;
    header.write(tag, entry, "latin1");
    header.writeUInt32BE(offset, entry + 4);
    header.writeUInt32BE(compressed.length, entry + 8);
    header.writeUInt32BE(original.length, entry + 12);
    bodies.push(compressed);
    offset += compressed.length;
  });
  return Buffer.concat([header, ...bodies]);
}

describe("reading a font file's own names", () => {
  it("reads a WOFF2 file's family, weight and style", async () => {
    const file = await readFile(
      createRequire(import.meta.url).resolve(
        "@lintel/builder-model/fonts/lora-latin-700-normal.woff2",
      ),
    );
    expect(readFontFileDetails(file)).toEqual({ family: "Lora", weight: "700", style: "normal" });
  });

  it("prefers the typographic family over a per-weight one", () => {
    const font = sfnt({
      name: nameTable({
        1: "Studio Sans SemiBold",
        2: "Italic",
        16: "Studio Sans",
        17: "SemiBold Italic",
      }),
      "OS/2": os2Table(600, true),
    });
    expect(readFontFileDetails(font)).toEqual({
      family: "Studio Sans",
      weight: "600",
      style: "italic",
    });
  });

  it("reads WOFF files", () => {
    const font = woff({
      name: nameTable({ 1: "Brand Serif", 2: "Regular" }),
      "OS/2": os2Table(350, false),
    });
    expect(readFontFileDetails(font)).toEqual({
      family: "Brand Serif",
      weight: "400",
      style: "normal",
    });
  });

  it("gives nothing for a file it can't read, rather than failing", () => {
    expect(readFontFileDetails(Buffer.from("not a font at all"))).toEqual({});
    expect(
      readFontFileDetails(Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(60, 0xff)])),
    ).toEqual({});
  });
});

describe("the font services' network", () => {
  it("only asks the font services, never anywhere else", async () => {
    const asked: string[] = [];
    const network = createFontNetwork(async (url) => {
      asked.push(url);
      return new Response("ok");
    });
    await expect(
      network.readText("https://169.254.169.254/latest", "google", 100),
    ).rejects.toThrow();
    await expect(
      network.readText("http://use.typekit.net/abc1def.css", "adobe", 100),
    ).rejects.toThrow();
    expect(asked).toEqual([]);
    expect(await network.readText("https://use.typekit.net/abc1def.css", "adobe", 100)).toBe("ok");
  });

  it("stops reading a file that is bigger than allowed", async () => {
    const network = createFontNetwork(async () => new Response(Buffer.alloc(5000)));
    await expect(
      network.readBytes("https://cdn.jsdelivr.net/x.woff2", "google", 1000),
    ).rejects.toThrow("couldn't reach Google Fonts");
  });

  it("gives up on a service that takes too long", async () => {
    const network = createFontNetwork(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
      20,
    );
    await expect(
      network.readText("https://api.fontsource.org/v1/fonts", "google", 100),
    ).rejects.toThrow("couldn't reach Google Fonts");
  });
});
