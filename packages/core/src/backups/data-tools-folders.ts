import { fileURLToPath } from "node:url";

/**
 * Where backups and imports keep their files: `.lintel/backups` and `.lintel/imports` at the
 * repository root (already gitignored), the same from `src` and `dist`. Set
 * LINTEL_BACKUPS_FOLDER to keep backups somewhere else, such as a mounted backup disk.
 */
export const DEFAULT_BACKUPS_FOLDER =
  process.env.LINTEL_BACKUPS_FOLDER ||
  fileURLToPath(new URL("../../../../.lintel/backups", import.meta.url));

export const DEFAULT_IMPORTS_FOLDER = fileURLToPath(
  new URL("../../../../.lintel/imports", import.meta.url),
);
