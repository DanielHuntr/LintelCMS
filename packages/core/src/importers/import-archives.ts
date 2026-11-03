import { posix } from "node:path";
import type { ArchiveLimits, ZipArchiveReader } from "../archives/zip-reader.js";

/**
 * Zips uploaded to the importers: a Webflow site export, a Statamic content folder, an
 * Umbraco uSync folder. They are read in place (nothing is ever unpacked to disk under a
 * name from the zip, see src/archives), within these limits, so a small upload can't
 * unpack to fill memory or the disk, and names that try to climb out of the folder
 * ("../../etc/passwd") or are absolute are never used.
 */
export const archiveLimitsForImports: ArchiveLimits = {
  maxFileBytes: 200 * 1024 * 1024,
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
  maxFiles: 20_000,
};

/** The most text (HTML, YAML, XML, JSON) one file may have to be read. */
const MAX_TEXT_BYTES = 20 * 1024 * 1024;

/** True for names the importers use: inside the zip, written with forward slashes. */
export function isSafeArchiveName(name: string): boolean {
  if (name.includes("\\") || name.includes("\0") || name.startsWith("/")) return false;
  if (/^[a-z]:/i.test(name)) return false;
  return !posix.normalize(name).split("/").includes("..") && !name.split("/").includes("..");
}

/**
 * A zip's file names, without the one folder people often zip around everything
 * ("my-site/index.html" → "index.html"), mapped to their real names in the zip. macOS's
 * "__MACOSX" copies are left out.
 */
export function listArchiveFiles(archive: ZipArchiveReader): Map<string, string> {
  const names = archive
    .listNames()
    .filter((name) => isSafeArchiveName(name) && !name.startsWith("__MACOSX/"));
  const firstFolders = new Set(names.map((name) => name.split("/")[0]));
  const [onlyFolder] = firstFolders;
  const strip =
    firstFolders.size === 1 && onlyFolder && names.every((name) => name.includes("/"))
      ? `${onlyFolder}/`
      : "";
  return new Map(names.map((name) => [name.slice(strip.length), name]));
}

/** A text file from the zip, or null when it is too big to be what the importer expects. */
export async function readArchiveText(
  archive: ZipArchiveReader,
  name: string,
): Promise<string | null> {
  if ((archive.sizeOf(name) ?? 0) > MAX_TEXT_BYTES) return null;
  return (await archive.readBuffer(name)).toString("utf8").replace(/^\uFEFF/, "");
}
