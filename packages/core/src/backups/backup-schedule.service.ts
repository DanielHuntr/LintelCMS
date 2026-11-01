import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { listCompleteBackupsBy } from "./backups.repository.js";
import type { BackupFrequency, BackupSchedule } from "./backups.schema.js";
import { type BackupsContext, deleteBackup, makeBackup } from "./backups.service.js";

/**
 * Daily and weekly backups. The scheduler asks every few minutes whether one is due (see
 * src/scheduler/scheduled-jobs.ts); a backup is due when the newest scheduled one is older
 * than the interval. Only scheduled backups count towards "keep": backups people make by
 * hand, or that Lintel makes before a restore, stay until someone deletes them.
 */
const ONE_HOUR = 60 * 60 * 1000;

const intervals: Record<Exclude<BackupFrequency, "off">, number> = {
  daily: 24 * ONE_HOUR,
  weekly: 7 * 24 * ONE_HOUR,
};

export function readBackupSchedule(context: Pick<BackupsContext, "database">) {
  return readSetting(context.database, "backupSchedule");
}

export async function saveBackupSchedule(
  context: BackupsContext,
  schedule: BackupSchedule,
): Promise<BackupSchedule> {
  await writeSetting(context.database, "backupSchedule", schedule);
  await removeOldScheduledBackups(context, schedule.keep);
  return schedule;
}

/**
 * True when a scheduled backup should be made now. A few minutes' slack keeps a daily
 * backup at about the same time each day instead of drifting later with every run.
 */
export function isScheduledBackupDue(
  frequency: BackupFrequency,
  lastScheduledAt: Date | undefined,
  now: Date,
): boolean {
  if (frequency === "off") {
    return false;
  }
  if (!lastScheduledAt) {
    return true;
  }
  const slack = 10 * 60 * 1000;
  return now.getTime() - lastScheduledAt.getTime() >= intervals[frequency] - slack;
}

/** Makes the scheduled backup if one is due. Returns whether it made one. */
export async function runScheduledBackupIfDue(
  context: BackupsContext,
  now = new Date(),
): Promise<boolean> {
  const schedule = await readBackupSchedule(context);
  const [newest] = await listCompleteBackupsBy(context.database, DEFAULT_TENANT_ID, "scheduled");
  if (!isScheduledBackupDue(schedule.frequency, newest?.createdAt, now)) {
    return false;
  }
  await makeBackup(context, "scheduled", null);
  await removeOldScheduledBackups(context, schedule.keep);
  return true;
}

async function removeOldScheduledBackups(context: BackupsContext, keep: number): Promise<void> {
  const scheduled = await listCompleteBackupsBy(context.database, DEFAULT_TENANT_ID, "scheduled");
  for (const old of scheduled.slice(keep)) {
    await deleteBackup(context, old.id);
  }
}
