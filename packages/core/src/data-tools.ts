/**
 * What the `lintel` command line tool (packages/cli) uses: backups, exports and imports,
 * creating admins, and the checks behind `lintel doctor`. Imported as
 * `@lintel/core/data-tools`. The rules all live in core; the tool only reads arguments,
 * calls these and prints what happened.
 */
export { loadConfig, loadProjectEnvFile, ConfigError, type Config } from "./config.js";
export { lintelPaths, openConfiguredDatabase, runWithFriendlyErrors } from "./startup.js";
// Add-ons: the `lintel addons` commands, and plugins' own commands (see src/addons).
export {
  addonsFolderIn,
  installedPackageFolder,
  prepareAddonsFolder,
  readAddonsList,
  writeAddonsList,
  type AddonsList,
} from "./addons/addons-list.js";
export {
  ADDON_MANIFEST_KEY,
  AddonPackageError,
  readAddonPackage,
  type AddonPackage,
} from "./addons/addon-package.js";
export { isVersionInRange } from "./addons/version-range.js";
export { loadSiteAddons } from "./addons/site-addons.js";
export { loadInstalledPlugins } from "./plugins/installed-plugins.js";
export {
  findPluginCommand,
  listPluginCommands,
  runPluginCommand,
} from "./plugins/plugin-commands.js";
export type { LintelPlugin } from "./plugins/plugin-definition.js";
export { describeActiveDatabase, type ActiveDatabase } from "./database/active-database.js";
export { DEFAULT_LINTEL_FOLDER, type LintelFolder } from "./database/database-choice.js";
export { DataFolderInUseError } from "./database/data-folder-lock.js";
export { describeDatabaseError, targetFromUrl } from "./database/database-errors.js";
export { countAppliedMigrations, listKnownMigrations } from "./database/migration-status.js";
export { openWithoutMigrating } from "./database/unmigrated-database.js";
export { LocalDiskStorage, DEFAULT_UPLOADS_FOLDER } from "./media/local-disk-storage.js";
export { BackgroundTasks } from "./scheduler/background-tasks.js";
export { defaultBackupsFolder } from "./backups/data-tools-folders.js";
export {
  inspectBackupArchive,
  restoreBackupArchive,
  writeBackupArchive,
  type BackupArchiveContext,
} from "./backups/backup-archive.service.js";
export { makeBackup, type BackupsContext } from "./backups/backups.service.js";
export type { RestoreSummary } from "./backups/backups.schema.js";
export { writeExport, type ExportOptions } from "./content-transfer/content-export.service.js";
export { previewImport, runImport } from "./content-transfer/content-import.service.js";
export { openImportSource } from "./content-transfer/import-source.js";
export type { ImportPlan, ImportKind } from "./content-transfer/content-import-plan.js";
export { conflictStrategies, type ConflictStrategy } from "./content-transfer/transfer-format.js";
export { HttpError } from "./http/http-errors.js";
export { emailSchema } from "./users/users.schema.js";
export { createAdmin, EmailAlreadyUsedError } from "./users/users.service.js";
export { fail, readNewPassword } from "./scripts/read-new-password.js";
export { promptPassword } from "./scripts/prompt-password.js";
export {
  commandLineSources,
  importFromFiles,
  type CommandLineSource,
  type ImportFromFilesResult,
} from "./importers/import-from-files.js";
export { defaultImportsFolder } from "./backups/data-tools-folders.js";
