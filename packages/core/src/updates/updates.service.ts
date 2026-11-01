import type { FastifyInstance } from "fastify";
import { isOwner } from "../roles/roles.service.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { currentLink, listInstalledVersions, readUpdateStatus } from "./install-home.js";
import {
  checkForUpdates,
  recommendedRelease,
  releasesForChannel,
  summariseUpdates,
  type UpdateChecksContext,
  type UpdateSummary,
} from "./update-checks.service.js";
import type {
  AvailableRelease,
  InstalledVersion,
  PluginUpdate,
  UpdateMethod,
  UpdatePreferences,
  UpdateProgress,
} from "./updates.schema.js";

/**
 * What Settings → Updates, the sidebar badge and the dashboard widget read. Install and
 * roll back are in update-install.service.ts, the checks in update-checks.service.ts.
 */
export interface UpdatesOverview {
  currentVersion: string;
  method: UpdateMethod;
  checksEnabled: boolean;
  feedIsDefault: boolean;
  checkedAt: string | null;
  problem: string | null;
  preferences: UpdatePreferences;
  releases: AvailableRelease[];
  /** What the Update button installs; null when there's nothing to install. */
  recommendedVersion: string | null;
  plugins: PluginUpdate[];
  summary: UpdateSummary;
  /** Only owners see the Update and Roll back buttons. */
  canInstall: boolean;
  /** Versions kept on disk, for rolling back (supervised installs only). */
  installedVersions: InstalledVersion[];
  progress: UpdateProgress | null;
}

export function updateChecksContextFor(server: FastifyInstance): UpdateChecksContext {
  return {
    database: server.database,
    fetch: server.updates.fetch,
    feedUrl: server.updates.feedUrl,
    currentVersion: server.updates.currentVersion,
    installFolder: server.updates.installFolder,
    email: server.email,
    adminUrl: server.adminOrigin,
    log: server.log,
  };
}

export async function readUpdatesOverview(
  server: FastifyInstance,
  userId: string,
): Promise<UpdatesOverview> {
  const updates = server.updates;
  const check = await readSetting(server.database, "updateCheck");
  const preferences = await readSetting(server.database, "updatePreferences");
  const releases = releasesForChannel(check.releases, preferences.channel, updates.currentVersion);
  const method = updates.method;
  return {
    currentVersion: updates.currentVersion,
    method,
    checksEnabled: updates.checksEnabled,
    feedIsDefault: updates.feedIsDefault,
    checkedAt: check.checkedAt,
    problem: check.problem,
    preferences,
    releases,
    recommendedVersion: recommendedRelease(releases, updates.currentVersion)?.version ?? null,
    plugins: check.plugins,
    summary: summariseUpdates(check, preferences, updates.currentVersion),
    canInstall: await isOwner(server.database, userId),
    installedVersions:
      method.installType === "supervised"
        ? await listInstalledVersions(updates.home, currentLink(updates.home))
        : [],
    progress: await readUpdateProgress(server),
  };
}

export async function readUpdateSummary(server: FastifyInstance): Promise<UpdateSummary> {
  return summariseUpdates(
    await readSetting(server.database, "updateCheck"),
    await readSetting(server.database, "updatePreferences"),
    server.updates.currentVersion,
  );
}

/**
 * The update this process is running, or else what the supervisor last wrote: how the
 * last switch ended, which the admin shows once after the restart.
 */
export async function readUpdateProgress(server: FastifyInstance): Promise<UpdateProgress | null> {
  return server.updates.currentProgress ?? (await readUpdateStatus(server.updates.home));
}

export async function checkForUpdatesNow(server: FastifyInstance) {
  if (!server.updates.checksEnabled) {
    return readSetting(server.database, "updateCheck");
  }
  return checkForUpdates(updateChecksContextFor(server));
}

export async function saveUpdatePreferences(
  server: FastifyInstance,
  preferences: UpdatePreferences,
): Promise<UpdatePreferences> {
  await writeSetting(server.database, "updatePreferences", preferences);
  return preferences;
}
