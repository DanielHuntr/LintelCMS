import { brotliDecompressSync, inflateSync } from "node:zlib";

/**
 * Reads a font file's own description of itself: its family name, weight and style, from
 * the `name` and `OS/2` tables inside it. Works for TTF and OTF files, and for WOFF and
 * WOFF2, which wrap the same tables in compression. Anything it can't read is left out, and
 * the admin falls back to guessing from the file name; the maker can change either.
 */
export interface FontFileDetails {
  family?: string;
  weight?: string;
  style?: "normal" | "italic";
}

/** A font file's tables are small; nothing near this size is a real name or OS/2 table. */
const MAX_TABLE_BYTES = 1024 * 1024;
const MAX_WOFF2_BYTES = 40 * 1024 * 1024;

export function readFontFileDetails(contents: Buffer): FontFileDetails {
  try {
    const tables = readTables(contents);
    if (!tables) return {};
    const names = tables.name ? readNames(tables.name) : {};
    const os2 = tables["OS/2"] ? readOs2(tables["OS/2"]) : {};
    const subfamily = names.subfamily ?? "";
    const italic = os2.italic === true || /italic|oblique/i.test(subfamily);
    return {
      ...(names.family ? { family: names.family } : {}),
      ...(os2.weight ? { weight: os2.weight } : {}),
      ...(tables["OS/2"] || subfamily ? { style: italic ? "italic" : "normal" } : {}),
    };
  } catch {
    // A damaged or unusual file just isn't described; it can still be used.
    return {};
  }
}

type WantedTables = Partial<Record<"name" | "OS/2", Buffer>>;
const wanted = new Set(["name", "OS/2"]);

function readTables(contents: Buffer): WantedTables | undefined {
  if (contents.length < 12) return undefined;
  const signature = contents.toString("latin1", 0, 4);
  if (signature === "wOF2") return readWoff2Tables(contents);
  if (signature === "wOFF") return readWoffTables(contents);
  if (signature === "OTTO" || signature === "true" || contents.readUInt32BE(0) === 0x00010000) {
    return readSfntTables(contents);
  }
  return undefined;
}

/** A plain TTF or OTF file: a table directory, then the tables. */
function readSfntTables(contents: Buffer): WantedTables {
  const count = contents.readUInt16BE(4);
  const tables: WantedTables = {};
  for (let index = 0; index < count; index += 1) {
    const entry = 12 + index * 16;
    const tag = contents.toString("latin1", entry, entry + 4);
    if (!wanted.has(tag)) continue;
    const offset = contents.readUInt32BE(entry + 8);
    const length = Math.min(contents.readUInt32BE(entry + 12), MAX_TABLE_BYTES);
    tables[tag as keyof WantedTables] = contents.subarray(offset, offset + length);
  }
  return tables;
}

/** WOFF: the same tables, each compressed on its own with zlib when that made it smaller. */
function readWoffTables(contents: Buffer): WantedTables {
  const count = contents.readUInt16BE(12);
  const tables: WantedTables = {};
  for (let index = 0; index < count; index += 1) {
    const entry = 44 + index * 20;
    const tag = contents.toString("latin1", entry, entry + 4);
    if (!wanted.has(tag)) continue;
    const offset = contents.readUInt32BE(entry + 4);
    const compressedLength = contents.readUInt32BE(entry + 8);
    const length = contents.readUInt32BE(entry + 12);
    if (length > MAX_TABLE_BYTES) continue;
    const stored = contents.subarray(offset, offset + compressedLength);
    tables[tag as keyof WantedTables] =
      compressedLength < length ? inflateSync(stored, { maxOutputLength: length }) : stored;
  }
  return tables;
}

/** The table tags WOFF2 knows by number, in the order the WOFF2 format lists them. */
const knownTags = [
  "cmap",
  "head",
  "hhea",
  "hmtx",
  "maxp",
  "name",
  "OS/2",
  "post",
  "cvt ",
  "fpgm",
  "glyf",
  "loca",
  "prep",
  "CFF ",
  "VORG",
  "EBDT",
  "EBLC",
  "gasp",
  "hdmx",
  "kern",
  "LTSH",
  "PCLT",
  "VDMX",
  "vhea",
  "vmtx",
  "BASE",
  "GDEF",
  "GPOS",
  "GSUB",
  "EBSC",
  "JSTF",
  "MATH",
  "CBDT",
  "CBLC",
  "COLR",
  "CPAL",
  "SVG ",
  "sbix",
  "acnt",
  "avar",
  "bdat",
  "bloc",
  "bsln",
  "cvar",
  "fdsc",
  "feat",
  "fmtx",
  "fvar",
  "gvar",
  "hsty",
  "just",
  "lcar",
  "mort",
  "morx",
  "opbd",
  "prop",
  "trak",
  "Zapf",
  "Silf",
  "Glat",
  "Gloc",
  "Feat",
  "Sill",
];

/**
 * WOFF2: a table directory with variable-length numbers, then every table in one Brotli
 * stream, one after another in directory order. Only glyf, loca and hmtx are ever
 * transformed, so the name and OS/2 tables come out as they went in.
 */
function readWoff2Tables(contents: Buffer): WantedTables | undefined {
  const flavor = contents.toString("latin1", 4, 8);
  if (flavor === "ttcf") return undefined;
  const count = contents.readUInt16BE(12);
  const totalSfntSize = contents.readUInt32BE(16);
  const compressedSize = contents.readUInt32BE(20);
  let position = 48;
  const readBase128 = (): number => {
    let value = 0;
    for (let index = 0; index < 5; index += 1) {
      const byte = contents.readUInt8(position);
      position += 1;
      value = value * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
    throw new Error("A WOFF2 number was too long");
  };

  const directory: Array<{ tag: string; offset: number; length: number }> = [];
  let streamOffset = 0;
  for (let index = 0; index < count; index += 1) {
    const flags = contents.readUInt8(position);
    position += 1;
    const tagIndex = flags & 0x3f;
    let tag = knownTags[tagIndex] ?? "";
    if (tagIndex === 63) {
      tag = contents.toString("latin1", position, position + 4);
      position += 4;
    }
    const transformVersion = (flags >> 6) & 0x03;
    const originalLength = readBase128();
    const transformed =
      tag === "glyf" || tag === "loca" ? transformVersion === 0 : transformVersion !== 0;
    const length = transformed ? readBase128() : originalLength;
    directory.push({ tag, offset: streamOffset, length });
    streamOffset += length;
  }
  const stream = brotliDecompressSync(contents.subarray(position, position + compressedSize), {
    maxOutputLength: Math.min(Math.max(totalSfntSize, streamOffset), MAX_WOFF2_BYTES),
  });
  const tables: WantedTables = {};
  for (const entry of directory) {
    if (wanted.has(entry.tag) && entry.length <= MAX_TABLE_BYTES) {
      tables[entry.tag as keyof WantedTables] = stream.subarray(
        entry.offset,
        entry.offset + entry.length,
      );
    }
  }
  return tables;
}

/**
 * The `name` table's family and style names. Windows English names come first; the
 * "typographic" family (id 16) wins over the plain one (id 1), which some fonts split per
 * weight ("Studio Sans SemiBold").
 */
function readNames(table: Buffer): { family?: string; subfamily?: string } {
  const count = table.readUInt16BE(2);
  const storage = table.readUInt16BE(4);
  const found = new Map<number, { text: string; rank: number }>();
  for (let index = 0; index < count; index += 1) {
    const record = 6 + index * 12;
    if (record + 12 > table.length) break;
    const platform = table.readUInt16BE(record);
    const language = table.readUInt16BE(record + 4);
    const nameId = table.readUInt16BE(record + 6);
    if (![1, 2, 16, 17].includes(nameId)) continue;
    const length = table.readUInt16BE(record + 8);
    const start = storage + table.readUInt16BE(record + 10);
    const bytes = table.subarray(start, start + length);
    const rank = platform === 3 ? (language === 0x0409 ? 3 : 2) : platform === 1 ? 1 : 0;
    if (rank === 0 || (found.get(nameId)?.rank ?? -1) >= rank) continue;
    const text = platform === 3 ? decodeUtf16(bytes) : bytes.toString("latin1");
    found.set(nameId, { text: text.trim(), rank });
  }
  const family = found.get(16)?.text || found.get(1)?.text;
  const subfamily = found.get(17)?.text || found.get(2)?.text;
  return {
    ...(family ? { family } : {}),
    ...(subfamily ? { subfamily } : {}),
  };
}

function decodeUtf16(bytes: Buffer): string {
  const swapped = Buffer.from(bytes.subarray(0, bytes.length - (bytes.length % 2)));
  swapped.swap16();
  return swapped.toString("utf16le");
}

/** The `OS/2` table's weight (100 to 900) and its italic flag. */
function readOs2(table: Buffer): { weight?: string; italic?: boolean } {
  const weightClass = table.length >= 6 ? table.readUInt16BE(4) : 0;
  const weight =
    weightClass >= 1 && weightClass <= 1000
      ? String(Math.min(9, Math.max(1, Math.round(weightClass / 100))) * 100)
      : undefined;
  const italic = table.length >= 64 ? (table.readUInt16BE(62) & 0x01) === 1 : undefined;
  return {
    ...(weight ? { weight } : {}),
    ...(italic !== undefined ? { italic } : {}),
  };
}
