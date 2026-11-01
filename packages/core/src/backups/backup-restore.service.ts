import { inspectBackupArchive, restoreBackupArchive } from "./backup-archive.service.js";
import { RestoreInProgressError } from "./backups.errors.js";
import type { RestoreSummary } from "./backups.schema.js";
import { type BackupsContext, findBackupArchive, makeBackup } from "./backups.service.js";

/**
 * Restoring from the backups list. Before anything is replaced Lintel backs up the site
 * as it is now ("Before restore" in the list), so a restore of the wrong backup can itself
 * be undone. Only one restore runs at a time per backups folder.
 */
const foldersBeingRestored = new Set<string>();

export async function previewRestore(
  context: BackupsContext,
  backupId: string,
): Promise<RestoreSummary> {
  const { path } = await findBackupArchive(context, backupId);
  return inspectBackupArchive(context, path);
}

export async function restoreBackup(
  context: BackupsContext,
  backupId: string,
  restoredByName: string | null,
): Promise<RestoreSummary & { safetyBackupId: string }> {
  if (foldersBeingRestored.has(context.folder)) {
    throw new RestoreInProgressError();
  }
  foldersBeingRestored.add(context.folder);
  try {
    const { path } = await findBackupArchive(context, backupId);
    // Checked before the safety backup, so a damaged archive doesn't leave one behind.
    await inspectBackupArchive(context, path);
    const safetyBackup = await makeBackup(context, "before-restore", restoredByName);
    const summary = await restoreBackupArchive(context, path);
    return { ...summary, safetyBackupId: safetyBackup.id };
  } finally {
    foldersBeingRestored.delete(context.folder);
  }
}
