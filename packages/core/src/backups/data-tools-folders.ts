import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where backups and imports keep their files: beside the built-in database, in
 * `<LINTEL_FOLDER>/backups` and `<LINTEL_FOLDER>/imports` (so `/data/backups` in the Docker
 * image, and `.lintel/backups` at the repository root, already gitignored, when
 * LINTEL_FOLDER isn't set). Set LINTEL_BACKUPS_FOLDER to keep backups somewhere else, such
 * as a mounted backup disk. Read when asked rather than on import, so a .env file loaded at
 * startup counts.
 */
const REPOSITORY_LINTEL_FOLDER = fileURLToPath(new URL("../../../../.lintel", import.meta.url));

function lintelFolder(environment: NodeJS.ProcessEnv): string {
  return environment.LINTEL_FOLDER ? resolve(environment.LINTEL_FOLDER) : REPOSITORY_LINTEL_FOLDER;
}

export function defaultBackupsFolder(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.LINTEL_BACKUPS_FOLDER || join(lintelFolder(environment), "backups");
}

export function defaultImportsFolder(environment: NodeJS.ProcessEnv = process.env): string {
  return join(lintelFolder(environment), "imports");
}
