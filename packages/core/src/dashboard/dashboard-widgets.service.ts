import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  countEntries,
  type DashboardEntryRow,
  listEntriesNeedingAttention,
  listRecentlyEditedEntries,
  listScheduledEntries,
  summariseMedia,
} from "./dashboard-widgets.repository.js";
import type { DashboardEntry, DashboardEntryList, MediaUsage } from "./dashboard-widgets.schema.js";

/** The data behind the built-in widgets. Each is a short list: a widget is a glance. */
const ENTRIES_PER_WIDGET = 6;

export async function findRecentEdits(
  database: DatabaseOrTransaction,
): Promise<DashboardEntryList> {
  const rows = await listRecentlyEditedEntries(database, DEFAULT_TENANT_ID, ENTRIES_PER_WIDGET);
  return { entries: rows.map(describeEntry), total: rows.length };
}

export async function findScheduledEntries(
  database: DatabaseOrTransaction,
): Promise<DashboardEntryList> {
  const [rows, total] = await Promise.all([
    listScheduledEntries(database, DEFAULT_TENANT_ID, ENTRIES_PER_WIDGET),
    countEntries(database, DEFAULT_TENANT_ID, "scheduled"),
  ]);
  return { entries: rows.map(describeEntry), total };
}

export async function findEntriesNeedingAttention(
  database: DatabaseOrTransaction,
): Promise<DashboardEntryList> {
  const [rows, total] = await Promise.all([
    listEntriesNeedingAttention(database, DEFAULT_TENANT_ID, ENTRIES_PER_WIDGET),
    countEntries(database, DEFAULT_TENANT_ID, "needsAttention"),
  ]);
  return { entries: rows.map(describeEntry), total };
}

export async function findMediaUsage(database: DatabaseOrTransaction): Promise<MediaUsage> {
  return summariseMedia(database, DEFAULT_TENANT_ID);
}

function describeEntry(row: DashboardEntryRow): DashboardEntry {
  return {
    id: row.id,
    title: row.title ?? "",
    status: row.status,
    collection: { handle: row.collectionHandle, name: row.collectionName },
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedByName,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    hasUnpublishedChanges: row.hasUnpublishedChanges,
  };
}
