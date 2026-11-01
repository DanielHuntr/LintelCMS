import { apiRequest, apiUrl } from "../api/client.js";

/** Calls to the API's update routes (see packages/core/src/updates). */

export type ReleaseChannel = "stable" | "beta";
export type InstallType = "supervised" | "process" | "docker" | "source" | "passenger" | "forge";
export type UpdateStep =
  | "checking"
  | "backing-up"
  | "downloading"
  | "verifying"
  | "unpacking"
  | "maintenance"
  | "migrating"
  | "switching"
  | "restarting"
  | "health-check"
  | "rolling-back"
  | "done"
  | "failed";

export interface AvailableRelease {
  version: string;
  name: string;
  channel: ReleaseChannel;
  publishedAt: string | null;
  /** Safe HTML made by the API from the release notes' Markdown. */
  notesHtml: string;
  summary: string;
  security: boolean;
  breaking: boolean;
  minimumVersion: string | null;
  pageUrl: string | null;
}

export interface PluginUpdate {
  packageName: string;
  installedVersion: string;
  latestVersion: string;
  pageUrl: string;
}

export interface UpdateMethod {
  installType: InstallType;
  oneClick: boolean;
  commands: string[];
}

export interface InstalledVersion {
  version: string;
  current: boolean;
  installedAt: string | null;
  backupBeforeLeaving: string | null;
}

export interface UpdateProgress {
  version: string;
  fromVersion: string;
  kind: "update" | "rollback";
  step: UpdateStep;
  message: string;
  fraction: number | null;
  startedAt: string;
  finishedAt: string | null;
  backupFilename: string | null;
}

export interface UpdateSummary {
  count: number;
  securityCount: number;
}

export interface UpdatesOverview {
  currentVersion: string;
  method: UpdateMethod;
  checksEnabled: boolean;
  feedIsDefault: boolean;
  checkedAt: string | null;
  problem: string | null;
  preferences: { channel: ReleaseChannel };
  releases: AvailableRelease[];
  recommendedVersion: string | null;
  plugins: PluginUpdate[];
  summary: UpdateSummary;
  canInstall: boolean;
  installedVersions: InstalledVersion[];
  progress: UpdateProgress | null;
}

export const getUpdates = () => apiRequest<UpdatesOverview>("/updates");
export const getUpdateSummary = () => apiRequest<UpdateSummary>("/updates/summary");
export const getAbout = () => apiRequest<{ version: string }>("/about");
export const getUpdateStatus = () =>
  apiRequest<{ updating: boolean; version: string | null }>("/updates/status");
export const getUpdateProgress = () =>
  apiRequest<{ progress: UpdateProgress | null; maintenance: boolean }>("/updates/progress");

export const checkForUpdates = () =>
  apiRequest<UpdatesOverview>("/updates/check", { method: "POST" });

export const saveUpdateChannel = (channel: ReleaseChannel) =>
  apiRequest<{ channel: ReleaseChannel }>("/updates/preferences", {
    method: "PUT",
    body: { channel },
  });

export const installUpdate = (version: string) =>
  apiRequest<UpdateProgress>("/updates/install", {
    method: "POST",
    body: { version, confirmed: true },
  });

export const rollBack = (version: string, restoreBackup: boolean) =>
  apiRequest<UpdateProgress>("/updates/rollback", {
    method: "POST",
    body: { version, restoreBackup, confirmed: true },
  });

export const updateProgressStreamUrl = `${apiUrl}/updates/progress/stream`;
