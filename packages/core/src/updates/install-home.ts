import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
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
 *     current -> versions/1.1.0      the version that runs
 *
 * Switching versions repoints `current` in one step (a new link renamed over the old), so
 * there is never a moment without one.
 */

export const RELEASE_MANIFEST_FILE = "release.json";

/** What a release folder says about itself: its version and where its programs are. */
export const releaseManifestSchema = z.object({
  version: z.string().refine(isVersion, { error: "Should be a version number" }),
  start: z.string().default("packages/core/dist/main.js"),
  migrate: z.string().default("packages/core/dist/scripts/migrate.js"),
  cli: z.string().default("packages/cli/dist/main.js"),
  admin: z.string().default("packages/admin/dist"),
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

/** The folder `current` points at, or `fallback` before the first update. */
export async function currentTarget(home: string, fallback: string): Promise<string> {
  const link = currentLink(home);
  return existsSync(link) ? realpath(link) : resolve(fallback);
}

/** Points `current` at `target` in one step. */
export async function pointCurrentAt(home: string, target: string): Promise<void> {
  const link = currentLink(home);
  const temporary = `${link}.next`;
  await rm(temporary, { force: true });
  // Relative, so the whole home folder can be moved; Windows junctions need the full path.
  const pointsAt = process.platform === "win32" ? target : relative(home, target) || ".";
  await symlink(pointsAt, temporary, "junction");
  await rename(temporary, link);
}

/** Every unpacked version, newest first, saying which one runs. */
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
    versions.push({
      version: name,
      current: (await realpath(path)) === running,
      installedAt: (await stat(path)).mtime.toISOString(),
      backupBeforeLeaving: leaving?.backupFilename ?? null,
    });
  }
  return versions.sort((left, right) => compareVersions(right.version, left.version));
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
