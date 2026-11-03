import { extname } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { FileTypeNotAllowedError } from "./media.errors.js";

/**
 * Which files Lintel accepts, and how it tells what a file really is.
 *
 * The name and the type the browser sends are both chosen by whoever uploads, so neither is
 * trusted: a program renamed to photo.png must not become a "PNG" that visitors download.
 * Binary formats are recognised by their first bytes. Text formats have no signature, so a
 * file that is readable text is treated as SVG when it is one, and otherwise as plain text
 * or CSV according to its extension, which is the only thing that tells those two apart.
 *
 * Animations for the page builder's Lottie and Rive elements are recognised by their
 * contents too: a Rive file starts with "RIVE", a .lottie is a zip with an animations
 * folder, and a Lottie .json is JSON with a frame rate and layers (see decision 0055).
 */

export interface AllowedFileType {
  mimeType: string;
  /** The extension Lintel gives the file, whatever it was called before. */
  extension: string;
  kind: "image" | "document" | "font" | "video" | "animation";
}

const allowedFileTypes = [
  { mimeType: "image/jpeg", extension: "jpg", kind: "image" },
  { mimeType: "image/png", extension: "png", kind: "image" },
  { mimeType: "image/webp", extension: "webp", kind: "image" },
  { mimeType: "image/avif", extension: "avif", kind: "image" },
  { mimeType: "image/gif", extension: "gif", kind: "image" },
  { mimeType: "image/svg+xml", extension: "svg", kind: "image" },
  { mimeType: "application/pdf", extension: "pdf", kind: "document" },
  {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
    kind: "document",
  },
  {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    kind: "document",
  },
  {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
    kind: "document",
  },
  { mimeType: "text/plain", extension: "txt", kind: "document" },
  { mimeType: "text/csv", extension: "csv", kind: "document" },
  // Fonts and videos for the page builder: custom fonts, and video backgrounds.
  { mimeType: "font/woff2", extension: "woff2", kind: "font" },
  { mimeType: "font/ttf", extension: "ttf", kind: "font" },
  { mimeType: "font/otf", extension: "otf", kind: "font" },
  { mimeType: "video/mp4", extension: "mp4", kind: "video" },
  { mimeType: "video/webm", extension: "webm", kind: "video" },
  // Animations for the Lottie and Rive elements.
  { mimeType: "application/json", extension: "json", kind: "animation" },
  { mimeType: "application/zip+dotlottie", extension: "lottie", kind: "animation" },
  { mimeType: "application/x-rive", extension: "riv", kind: "animation" },
] as const satisfies readonly AllowedFileType[];

export type AllowedMimeType = (typeof allowedFileTypes)[number]["mimeType"];

/** Images sharp can resize. SVG is included: sharp draws it before resizing. */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function findAllowedFileType(mimeType: string): AllowedFileType | undefined {
  return allowedFileTypes.find((fileType) => fileType.mimeType === mimeType);
}

/**
 * What the file really is, from its bytes. Throws FileTypeNotAllowedError for anything
 * outside the list above, naming what the file turned out to be when that is known.
 */
export async function detectFileType(
  contents: Buffer,
  originalFilename: string,
): Promise<AllowedFileType> {
  if (isRiveFile(contents)) {
    return allowedFileTypeFor("application/x-rive");
  }
  const signature = await fileTypeFromBuffer(contents);
  if (signature?.mime === "application/zip" && isDotLottie(contents)) {
    return allowedFileTypeFor("application/zip+dotlottie");
  }
  // An SVG with an <?xml ...?> declaration is reported as generic XML; the text checks below
  // decide whether it is an SVG.
  if (signature && !isXmlMimeType(signature.mime)) {
    const allowed = findAllowedFileType(signature.mime);
    if (!allowed) {
      throw new FileTypeNotAllowedError(originalFilename, signature.ext);
    }
    return allowed;
  }

  const text = decodeAsText(contents);
  if (text === undefined) {
    throw new FileTypeNotAllowedError(originalFilename);
  }
  if (looksLikeSvg(text)) {
    return allowedFileTypeFor("image/svg+xml");
  }
  if (isLottieJson(text)) {
    return allowedFileTypeFor("application/json");
  }

  const extension = extname(originalFilename).slice(1).toLowerCase();
  if (extension === "csv") {
    return allowedFileTypeFor("text/csv");
  }
  if (extension === "txt" || extension === "text") {
    return allowedFileTypeFor("text/plain");
  }
  // Readable text called something else (an .html or .js file, say) is still not allowed.
  throw new FileTypeNotAllowedError(originalFilename, extension || undefined);
}

/** The bytes as UTF-8 text, or undefined when they aren't text (invalid UTF-8 or a NUL byte). */
export function decodeAsText(contents: Buffer): string | undefined {
  if (contents.includes(0)) {
    return undefined;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(contents);
  } catch {
    return undefined;
  }
}

/** An `<svg>` root element, after an optional byte order mark, XML declaration, comments or doctype. */
function looksLikeSvg(text: string): boolean {
  const withoutPreamble = text
    .replace(/^\uFEFF/, "")
    .replace(/^\s*<\?xml[\s\S]*?\?>/, "")
    .replace(/^(\s*<!--[\s\S]*?-->)*/, "")
    .replace(/^\s*<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/i, "")
    .replace(/^(\s*<!--[\s\S]*?-->)*/, "");
  return /^\s*<svg[\s>]/i.test(withoutPreamble);
}

/** A Rive file: "RIVE", then its format's version number. */
export function isRiveFile(contents: Buffer): boolean {
  return contents.length > 8 && contents.subarray(0, 4).toString("latin1") === "RIVE";
}

/** The file names in a zip's directory, read without unpacking anything. */
export function zipEntryNames(contents: Buffer): string[] {
  const endSignature = 0x06054b50;
  let end = contents.length - 22;
  while (end >= 0 && contents.readUInt32LE(end) !== endSignature) end -= 1;
  if (end < 0) return [];
  const count = contents.readUInt16LE(end + 10);
  let offset = contents.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let index = 0; index < count && offset + 46 <= contents.length; index += 1) {
    if (contents.readUInt32LE(offset) !== 0x02014b50) break;
    const nameLength = contents.readUInt16LE(offset + 28);
    const extraLength = contents.readUInt16LE(offset + 30);
    const commentLength = contents.readUInt16LE(offset + 32);
    names.push(contents.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

/** A .lottie: a zip holding at least one animation's JSON in its animations folder. */
export function isDotLottie(contents: Buffer): boolean {
  return zipEntryNames(contents).some((name) => /^animations\/[^/]+\.json$/.test(name));
}

/** A Lottie animation's JSON: an object with a version, a frame rate, a length and layers. */
export function isLottieJson(text: string): boolean {
  try {
    const data = JSON.parse(text) as Record<string, unknown> | null;
    return (
      typeof data === "object" &&
      data !== null &&
      typeof data.v === "string" &&
      typeof data.fr === "number" &&
      typeof data.op === "number" &&
      Array.isArray(data.layers)
    );
  } catch {
    return false;
  }
}

function isXmlMimeType(mimeType: string): boolean {
  return mimeType === "application/xml" || mimeType === "text/xml";
}

function allowedFileTypeFor(mimeType: AllowedMimeType): AllowedFileType {
  const allowed = findAllowedFileType(mimeType);
  if (!allowed) {
    throw new Error(`${mimeType} is missing from the allowed file types.`);
  }
  return allowed;
}
