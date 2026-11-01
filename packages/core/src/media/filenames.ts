import { extname } from "node:path";

/** Long enough for any sensible name, short enough for every file system and URL. */
const MAX_FILENAME_LENGTH = 120;

/**
 * A filename that is safe to store, show and send back in a download header: no folders,
 * no control or reserved characters, no leading dots, and the extension of what the file
 * really is (so "logo.png" that is really a JPEG becomes "logo.jpg").
 */
export function sanitiseFilename(original: string, extension: string): string {
  const baseName = (original.split(/[/\\]/).pop() ?? "")
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/[<>:"|?*]/g, "")
    .replace(/\s+/g, " ");
  const withoutExtension = stripExtension(baseName)
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, MAX_FILENAME_LENGTH - extension.length - 1)
    .trim();

  return `${withoutExtension || "file"}.${extension}`;
}

function stripExtension(filename: string): string {
  const extension = extname(filename);
  return extension ? filename.slice(0, -extension.length) : filename;
}
