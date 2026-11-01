import { bigint, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import type { BackupContents } from "./backup-manifest.js";
import { backupStatuses, backupTriggers } from "./backups.schema.js";

/**
 * One backup archive in the backups folder, and how making it went. The archive itself is
 * a .zip on disk (see backup-archive.service.ts); this row is what the admin lists.
 *
 * - `trigger` says who made it: someone in the admin, the daily or weekly schedule, Lintel
 *   itself just before a restore, or an upload of an archive made elsewhere.
 * - `status` is "running" while it is being written, then "complete" or "failed".
 *
 * There is deliberately no reference to the users table: restoring a backup replaces the
 * users, and this list has to survive that. `createdByName` is kept as plain text.
 */
export const backupsTable = pgTable(
  "backups",
  {
    id: id(),
    tenantId: tenantId(),
    filename: text("filename").notNull(),
    trigger: text("trigger", { enum: backupTriggers }).notNull(),
    status: text("status", { enum: backupStatuses }).notNull().default("running"),
    size: bigint("size", { mode: "number" }),
    checksum: text("checksum"),
    contents: jsonb("contents").$type<BackupContents>(),
    failureReason: text("failure_reason"),
    createdByName: text("created_by_name"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("backups_tenant_filename_unique").on(table.tenantId, table.filename),
    index("backups_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export type BackupRow = typeof backupsTable.$inferSelect;
export type NewBackupRow = typeof backupsTable.$inferInsert;
