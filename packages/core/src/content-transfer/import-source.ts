import { open, readFile } from "node:fs/promises";
import { z } from "zod";
import { ZipArchiveReader } from "../archives/zip-reader.js";
import { NotAnExportError } from "./content-transfer.errors.js";
import {
  EXPORT_DOCUMENT,
  EXPORT_FORMAT_VERSION,
  type LintelExport,
  lintelExportSchema,
} from "./transfer-format.js";

/**
 * An export opened for importing: the document, and the media files beside it when it is
 * a .zip. A plain .json export has no files, so only media already here can be matched.
 */
export interface ImportSource {
  document: LintelExport;
  files: ReadonlySet<string>;
  readFile(path: string): Promise<Buffer>;
  close(): void;
}

export async function openImportSource(path: string): Promise<ImportSource> {
  if (await looksLikeZip(path)) {
    const reader = await ZipArchiveReader.open(path);
    try {
      if (!reader.has(EXPORT_DOCUMENT)) {
        throw new NotAnExportError(`it has no ${EXPORT_DOCUMENT}`);
      }
      const document = parseExport(await reader.readJson(EXPORT_DOCUMENT));
      return {
        document,
        files: new Set(reader.listNames()),
        readFile: (name) => reader.readBuffer(name),
        close: () => reader.close(),
      };
    } catch (error) {
      reader.close();
      throw error;
    }
  }

  let json: unknown;
  try {
    json = JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    throw new NotAnExportError("it is neither a .zip nor a JSON file");
  }
  return {
    document: parseExport(json),
    files: new Set(),
    readFile: () => Promise.reject(new NotAnExportError("it has no media files")),
    close: () => {},
  };
}

function parseExport(json: unknown): LintelExport {
  const parsed = lintelExportSchema.safeParse(json);
  if (!parsed.success) {
    throw new NotAnExportError(z.prettifyError(parsed.error).split("\n")[0] ?? "unknown layout");
  }
  if (parsed.data.formatVersion > EXPORT_FORMAT_VERSION) {
    throw new NotAnExportError("it was made by a newer version of Lintel; update Lintel first");
  }
  return parsed.data;
}

/** Zip files start with "PK\x03\x04". */
async function looksLikeZip(path: string): Promise<boolean> {
  const file = await open(path, "r");
  try {
    const start = Buffer.alloc(4);
    await file.read(start, 0, 4, 0);
    return start.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  } finally {
    await file.close();
  }
}
