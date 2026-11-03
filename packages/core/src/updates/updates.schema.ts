import { z } from "zod";

/** Stable releases, or betas and release candidates too. */
export const releaseChannels = ["stable", "beta"] as const;
export type ReleaseChannel = (typeof releaseChannels)[number];

export const releaseAssetSchema = z.object({
  name: z.string(),
  url: z.string(),
  size: z.number().int().nonnegative().nullable(),
});
export type ReleaseAsset = z.infer<typeof releaseAssetSchema>;

/** One version of Lintel from the update feed, read and tidied (see update-feed.ts). */
export const availableReleaseSchema = z.object({
  version: z.string(),
  name: z.string(),
  channel: z.enum(releaseChannels),
  publishedAt: z.string().nullable(),
  /** The release notes as safe HTML, rendered from their Markdown. */
  notesHtml: z.string(),
  /** The first paragraph of the notes in plain words, for lists and emails. */
  summary: z.string(),
  /** Fixes a security problem: people are told by email and the update is marked. */
  security: z.boolean(),
  /** Changes something sites or plugins may rely on: the notes say what. */
  breaking: z.boolean(),
  /** The oldest version that can update straight to this one; null when any can. */
  minimumVersion: z.string().nullable(),
  /** The release's page, for "Read the full notes". */
  pageUrl: z.string().nullable(),
  assets: z.array(releaseAssetSchema),
});
export type AvailableRelease = z.infer<typeof availableReleaseSchema>;

export const pluginUpdateSchema = z.object({
  packageName: z.string(),
  installedVersion: z.string(),
  latestVersion: z.string(),
  pageUrl: z.string(),
});
export type PluginUpdate = z.infer<typeof pluginUpdateSchema>;

/** What the last check found, kept in settings so a restart doesn't forget it. */
export const updateCheckSchema = z.object({
  checkedAt: z.string().nullable(),
  /** Newer versions than the one running, newest first, on any channel. */
  releases: z.array(availableReleaseSchema),
  plugins: z.array(pluginUpdateSchema),
  /** Why the last check didn't work, in plain words; null when it did. */
  problem: z.string().nullable(),
  /** Security releases owners have already been emailed about. */
  emailedSecurityVersions: z.array(z.string()),
});
export type UpdateCheck = z.infer<typeof updateCheckSchema>;

export const emptyUpdateCheck: UpdateCheck = {
  checkedAt: null,
  releases: [],
  plugins: [],
  problem: null,
  emailedSecurityVersions: [],
};

/** Settings → Updates' own choices, kept in settings. */
export const updatePreferencesSchema = z.object({
  channel: z.enum(releaseChannels),
});
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;
export const defaultUpdatePreferences: UpdatePreferences = { channel: "stable" };

export const installTypes = [
  "supervised",
  "process",
  "docker",
  "source",
  "passenger",
  "forge",
] as const;
export type InstallType = (typeof installTypes)[number];

/** How this copy of Lintel is updated, as Settings → Updates explains it. */
export const updateMethodSchema = z.object({
  installType: z.enum(installTypes),
  /** The Update button works here. */
  oneClick: z.boolean(),
  /** Commands to run, when updating is done by hand. `{version}` is filled in by the admin. */
  commands: z.array(z.string()),
});
export type UpdateMethod = z.infer<typeof updateMethodSchema>;

export const updateStepIds = [
  "checking",
  "backing-up",
  "downloading",
  "verifying",
  "unpacking",
  "maintenance",
  "migrating",
  "switching",
  "restarting",
  "health-check",
  "rolling-back",
  "done",
  "failed",
] as const;
export type UpdateStepId = (typeof updateStepIds)[number];

/** Where an update or a roll back has got to, as the admin shows it live. */
export const updateProgressSchema = z.object({
  /** The version being installed (or rolled back to). */
  version: z.string(),
  fromVersion: z.string(),
  kind: z.enum(["update", "rollback"]),
  step: z.enum(updateStepIds),
  /** One plain sentence about the step. */
  message: z.string(),
  /** 0–1 while downloading; null otherwise. */
  fraction: z.number().min(0).max(1).nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  /** The backup made first, by file name (Settings → Backups). */
  backupFilename: z.string().nullable(),
  /**
   * The copy of the built-in database made at the switch, with the site already stopped,
   * by id (see supervisor/database-copies.ts). Older entries don't have it.
   */
  databaseCopy: z.string().nullable().default(null),
});
export type UpdateProgress = z.infer<typeof updateProgressSchema>;

export const installedVersionSchema = z.object({
  version: z.string(),
  current: z.boolean(),
  installedAt: z.string().nullable(),
  /** The backup made just before updating away from this version, if there is one. */
  backupBeforeLeaving: z.string().nullable(),
  /** The copy of the database made as Lintel left this version, if it's still kept. */
  databaseCopyBeforeLeaving: z.string().nullable(),
  /**
   * The running version has database changes this one doesn't know, so going back to it
   * also means putting back that copy of the database.
   */
  databaseDiffers: z.boolean(),
});
export type InstalledVersion = z.infer<typeof installedVersionSchema>;

export const startUpdateBodySchema = z.object({
  version: z.string().min(1),
  /** The person ticked "I understand a backup is made first". */
  confirmed: z.literal(true, { error: "Please confirm before updating" }),
});

export const startRollbackBodySchema = z.object({
  version: z.string().min(1),
  /** Also put the database back as it was when Lintel updated away from that version. */
  restoreBackup: z.boolean(),
  confirmed: z.literal(true, { error: "Please confirm before rolling back" }),
});

export const updatePreferencesBodySchema = updatePreferencesSchema;
