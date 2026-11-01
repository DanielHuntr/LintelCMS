import { z } from "zod";
import { backupContentsSchema } from "./backup-manifest.js";

export const backupTriggers = [
  "manual",
  "scheduled",
  "before-restore",
  "before-update",
  "uploaded",
] as const;
export const backupStatuses = ["running", "complete", "failed"] as const;
export const backupFrequencies = ["off", "daily", "weekly"] as const;

export type BackupTrigger = (typeof backupTriggers)[number];
export type BackupStatus = (typeof backupStatuses)[number];
export type BackupFrequency = (typeof backupFrequencies)[number];

/** Settings → Backups: how often Lintel backs up on its own, and how many of those to keep. */
export const backupScheduleSchema = z.object({
  frequency: z.enum(backupFrequencies, {
    error: "How often should be off, daily or weekly",
  }),
  keep: z
    .number({ error: "How many to keep should be a number" })
    .int({ error: "How many to keep should be a whole number" })
    .min(1, { error: "Keep at least 1 backup" })
    .max(100, { error: "Lintel can keep at most 100 scheduled backups" }),
});

export type BackupSchedule = z.infer<typeof backupScheduleSchema>;

export const defaultBackupSchedule: BackupSchedule = { frequency: "off", keep: 7 };

export const backupIdParamsSchema = z.object({ id: z.uuid() });

export const restoreBackupRequestSchema = z.object({
  /** Typed by the person restoring, so a restore never happens by a stray click. */
  confirm: z.literal("RESTORE", { error: "Type RESTORE to confirm" }),
});

export const backupSchema = z.object({
  id: z.uuid(),
  filename: z.string(),
  trigger: z.enum(backupTriggers),
  status: z.enum(backupStatuses),
  size: z.number().nullable(),
  checksum: z.string().nullable(),
  contents: backupContentsSchema.nullable(),
  failureReason: z.string().nullable(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export type BackupResponse = z.infer<typeof backupSchema>;

/** What a restore would replace, or did: rows per table in the backup and here now. */
export const restoreSummarySchema = z.object({
  createdAt: z.string(),
  tables: z.array(
    z.object({ table: z.string(), inBackup: z.number().int(), current: z.number().int() }),
  ),
  mediaFiles: z.number().int(),
  settings: z.number().int(),
});

export type RestoreSummary = z.infer<typeof restoreSummarySchema>;
