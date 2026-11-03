import { existsSync } from "node:fs";
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
import { listKnownMigrations } from "../database/migration-status.js";
import { compareVersions, isVersion } from "./semantic-version.js";
import {
  type InstalledVersion,
  type UpdateProgress,
  updateProgressSchema,
} from "./updates.schema.js";

/**
 * The folder a supervised Lintel lives in (`lintel start`), with versions side by side:
 *
 *   <home>/
 *     .env                     settings, shared by every version
 *     lintel.config.ts         plugin packages, copied into each new version
 *     data/                    the built-in database, uploads and backups (LINTEL_FOLDER)
 *     versions/1.0.0/          one unpacked release each (see release-manifest below)
 *     versions/1.1.0/
 *     versions/update-status.json    where the last update or roll back got to
 *     versions/update-history.json   every switch, newest last
 *     versions/switch-journal.json   a switch under way (see supervisor/switch-journal.ts)
 *     versions/database-copies/      the built-in database as it was before each switch
 *     current -> versions/1.1.0      the version that runs
 *
 * Switching versions repoints `current`. On Linux and macOS a new link is renamed over the
 * old one, so there is never a moment without one. Windows won't rename a junction over
 * another, so there the old one is removed first and the new one, already made as
 * `current.next`, renamed into place; if Lintel stops between the two, `current.next` is
 * still there and `repairCurrentLink` finishes the job on the next start.
 */

export const RELEASE_MANIFEST_FILE = "release.json";

/** What a release folder says about itself: its version and where its programs are. */
export const releaseManifestSchema = z.object({
  version: z.string().refine(isVersion, { error: "Should be a version number" }),
  start: z.string().default("packages/core/dist/main.js"),
  migrate: z.string().default("packages/core/dist/scripts/migrate.js"),
  cli: z.string().default("packages/cli/dist/main.js"),
  admin: z.string().default("packages/admin/dist"),
  /** The release's database migrations, to tell whether two versions' tables differ. */
  migrations: z.string().default("packages/core/migrations"),
});
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;

export function versionsFolder(home: string): string {
  return join(home, "versions");
}

export function versionFolder(home: string, version: string): string {
  return join(versionsFolder(home), version);
}

export function currentLink(home: string): string {
  return join(home, "current");
}

const statusFile = (home: string) => join(versionsFolder(home), "update-status.json");
const historyFile = (home: string) => join(versionsFolder(home), "update-history.json");

/**
 * The release folder's manifest. A folder without one (a repository checkout started with
 * `lintel start`) is described by `fallbackVersion` and the usual paths.
 */
export async function readReleaseManifest(
  folder: string,
  fallbackVersion?: string,
): Promise<ReleaseManifest> {
  const file = join(folder, RELEASE_MANIFEST_FILE);
  if (!existsSync(file)) {
    if (!fallbackVersion) {
      throw new Error(`${folder} has no ${RELEASE_MANIFEST_FILE}, so it isn't a Lintel release`);
    }
    return releaseManifestSchema.parse({ version: fallbackVersion });
  }
  return releaseManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

/**
 * The migrations a release folder ships, oldest first, or null when they can't be read
 * (which callers treat as "may differ"). A folder without release.json is a repository
 * checkout, with migrations in the usual place.
 */
export async function releaseMigrations(folder: string): Promise<string[] | null> {
  try {
    const manifestFile = join(folder, RELEASE_MANIFEST_FILE);
    const migrations = existsSync(manifestFile)
      ? releaseManifestSchema.parse(JSON.parse(await readFile(manifestFile, "utf8"))).migrations
      : releaseManifestSchema.shape.migrations.parse(undefined);
    return listKnownMigrations(join(folder, migrations));
  } catch {
    return null;
  }
}

/**
 * Whether going from the release in `fromFolder` to the one in `toFolder` leaves the
 * database with tables the second doesn't know: true when `fromFolder`'s release has a
 * migration `toFolder`'s hasn't, or when either can't be read.
 */
export async function databaseDiffers(fromFolder: string, toFolder: string): Promise<boolean> {
  const [from, to] = await Promise.all([
    releaseMigrations(fromFolder),
    releaseMigrations(toFolder),
  ]);
  if (!from || !to) {
    return true;
  }
  const known = new Set(to);
  return from.some((tag) => !known.has(tag));
}

/** The folder `current` points at, or `fallback` before the first update. */
export async function currentTarget(home: string, fallback: string): Promise<string> {
  await repairCurrentLink(home);
  const link = currentLink(home);
  return existsSync(link) ? realpath(link) : resolve(fallback);
}

/**
 * Points `current` at `target`. `platform` is only for tests, so both ways are tried on
 * any computer.
 */
export async function pointCurrentAt(
  home: string,
  target: string,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  const link = currentLink(home);
  const temporary = nextLink(home);
  await removeLink(temporary);
  // Relative, so the whole home folder can be moved; Windows junctions need the full path.
  const pointsAt = platform === "win32" ? resolve(target) : relative(home, target) || ".";
  await symlink(pointsAt, temporary, "junction");
  if (platform === "win32") {
    // Renaming a junction over another fails with EPERM, so the old one goes first.
    await removeLink(link);
  }
  await rename(temporary, link);
}

/**
 * Finishes a switch of `current` cut off between removing the old link and renaming the
 * new one into place (Windows only does it in two steps). Returns true if it did.
 */
export async function repairCurrentLink(home: string): Promise<boolean> {
  const link = currentLink(home);
  const temporary = nextLink(home);
  if ((await isLink(link)) || !(await isLink(temporary))) {
    return false;
  }
  await rename(temporary, link);
  return true;
}

function nextLink(home: string): string {
  return `${currentLink(home)}.next`;
}

async function isLink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Removes a link (or junction) without touching the folder it points at. */
async function removeLink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

/**
 * Every unpacked version, newest first, saying which one `runningFolder` (usually `current`)
 * is, which copy of the database was made just before leaving it, and whether going back to
 * it would leave the database with tables it doesn't know.
 */
export async function listInstalledVersions(
  home: string,
  runningFolder: string,
): Promise<InstalledVersion[]> {
  const folder = versionsFolder(home);
  if (!existsSync(folder)) {
    return [];
  }
  const running = await realpath(runningFolder).catch(() => resolve(runningFolder));
  const history = await readUpdateHistory(home);
  const versions: InstalledVersion[] = [];
  for (const name of await readdir(folder)) {
    const path = join(folder, name);
    if (!isVersion(name) || !(await stat(path)).isDirectory()) {
      continue;
    }
    const leaving = history.findLast((entry) => entry.fromVersion === name && entry.backupFilename);
    const copied = history.findLast(
      (entry) =>
        entry.fromVersion === name &&
        entry.databaseCopy !== null &&
        databaseCopyExists(home, entry.databaseCopy),
    );
    const current = (await realpath(path)) === running;
    versions.push({
      version: name,
      current,
      installedAt: (await stat(path)).mtime.toISOString(),
      backupBeforeLeaving: leaving?.backupFilename ?? null,
      databaseCopyBeforeLeaving: copied?.databaseCopy ?? null,
      databaseDiffers: current ? false : await databaseDiffers(running, path),
    });
  }
  return versions.sort((left, right) => compareVersions(right.version, left.version));
}

/** Where copies of the built-in database are kept (see supervisor/database-copies.ts). */
export function databaseCopiesFolder(home: string): string {
  return join(versionsFolder(home), "database-copies");
}

/** A copy is complete once its copy.json is written, which is done last. */
export function databaseCopyExists(home: string, copyId: string): boolean {
  return (
    /^[\w.-]+$/.test(copyId) && existsSync(join(databaseCopiesFolder(home), copyId, "copy.json"))
  );
}

export async function readUpdateStatus(home: string): Promise<UpdateProgress | null> {
  try {
    const parsed = updateProgressSchema.safeParse(
      JSON.parse(await readFile(statusFile(home), "utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeUpdateStatus(home: string, progress: UpdateProgress): Promise<void> {
  await mkdir(versionsFolder(home), { recursive: true });
  const file = statusFile(home);
  await writeFile(`${file}.next`, JSON.stringify(progress, null, 2));
  await rename(`${file}.next`, file);
}

const historyEntrySchema = updateProgressSchema;
export type UpdateHistoryEntry = UpdateProgress;

export async function readUpdateHistory(home: string): Promise<UpdateHistoryEntry[]> {
  try {
    const parsed = z
      .array(historyEntrySchema)
      .safeParse(JSON.parse(await readFile(historyFile(home), "utf8")));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Adds a finished update or roll back to the history; the last 50 are kept. */
export async function recordUpdateHistory(home: string, entry: UpdateHistoryEntry): Promise<void> {
  const history = [...(await readUpdateHistory(home)), entry].slice(-50);
  await mkdir(versionsFolder(home), { recursive: true });
  await writeFile(historyFile(home), JSON.stringify(history, null, 2));
}
