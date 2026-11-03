import { extname } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { FileTypeNotAllowedError } from "./media.errors.js";
import { looksLikeGltf } from "./model-files.js";

/**
 * Which files Lintel accepts, and how it tells what a file really is.
 *
 * The name and the type the browser sends are both chosen by whoever uploads, so neither is
 * trusted: a program renamed to photo.png must not become a "PNG" that visitors download.
 * Binary formats are recognised by their first bytes. Text formats have no signature, so a
 * file that is readable text is treated as SVG when it is one, and otherwise as plain text
 * or CSV according to its extension, which is the only thing that tells those two apart.
 */

export interface AllowedFileType {
  mimeType: string;
  /** The extension Lintel gives the file, whatever it was called before. */
  extension: string;
  kind: "image" | "document" | "font" | "video" | "model";
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
  // 3D models for the 3D model element. A .gltf is packed into a .glb (see model-files.ts).
  { mimeType: "model/gltf-binary", extension: "glb", kind: "model" },
] as const satisfies readonly AllowedFileType[];

export type AllowedMimeType = (typeof allowedFileTypes)[number]["mimeType"];

/** 3D models: .glb files (a .gltf is packed into one as it is uploaded). */
export function isModelMimeType(mimeType: string): boolean {
  return mimeType.startsWith("model/");
}

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
  const signature = await fileTypeFromBuffer(contents);
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

  const extension = extname(originalFilename).slice(1).toLowerCase();
  if (extension === "gltf" && looksLikeGltf(text)) {
    return allowedFileTypeFor("model/gltf-binary");
  }
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
