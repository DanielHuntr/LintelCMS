import { and, asc, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { assetsTable } from "../media/media.table.js";
import { usersTable } from "../users/users.table.js";

/** Reads for the built-in dashboard widgets, nothing else. */

export interface DashboardEntryRow {
  id: string;
  title: string | null;
  status: "draft" | "published" | "scheduled";
  collectionHandle: string;
  collectionName: string;
  updatedAt: Date;
  scheduledFor: Date | null;
  updatedByName: string | null;
  hasUnpublishedChanges: boolean;
}

/** The working copy differs from what is live: saved, but not published again since. */
const hasUnpublishedChanges = sql<boolean>`(${entriesTable.publishedData} is not null and ${entriesTable.data} <> ${entriesTable.publishedData})`;

const entryColumns = {
  id: entriesTable.id,
  title: sql<string | null>`${entriesTable.data}->>'title'`,
  status: entriesTable.status,
  collectionHandle: collectionsTable.handle,
  collectionName: collectionsTable.name,
  updatedAt: entriesTable.updatedAt,
  scheduledFor: entriesTable.scheduledFor,
  updatedByName: usersTable.name,
  hasUnpublishedChanges,
};

function entriesWithCollections(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select(entryColumns)
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .leftJoin(usersTable, eq(usersTable.id, entriesTable.updatedBy))
    .where(eq(entriesTable.tenantId, tenantId))
    .$dynamic();
}

export async function listRecentlyEditedEntries(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
): Promise<DashboardEntryRow[]> {
  return entriesWithCollections(database, tenantId)
    .orderBy(desc(entriesTable.updatedAt))
    .limit(limit);
}

/** The entries this person changed last, most recent first. */
export async function listEntriesEditedBy(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
  limit: number,
): Promise<DashboardEntryRow[]> {
  return entriesWithCollections(database, tenantId)
    .where(and(eq(entriesTable.tenantId, tenantId), eq(entriesTable.updatedBy, userId)))
    .orderBy(desc(entriesTable.updatedAt))
    .limit(limit);
}

const isScheduled = and(eq(entriesTable.status, "scheduled"), isNotNull(entriesTable.scheduledFor));

export async function listScheduledEntries(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
): Promise<DashboardEntryRow[]> {
  return entriesWithCollections(database, tenantId)
    .where(and(eq(entriesTable.tenantId, tenantId), isScheduled))
    .orderBy(asc(entriesTable.scheduledFor))
    .limit(limit);
}

/** Drafts, and live entries with saved changes that aren't published yet. */
const needsAttention = or(eq(entriesTable.status, "draft"), hasUnpublishedChanges);

export async function listEntriesNeedingAttention(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
): Promise<DashboardEntryRow[]> {
  // Oldest first: the ones left longest are the likeliest to have been forgotten.
  return entriesWithCollections(database, tenantId)
    .where(and(eq(entriesTable.tenantId, tenantId), needsAttention))
    .orderBy(asc(entriesTable.updatedAt))
    .limit(limit);
}

export async function countEntries(
  database: DatabaseOrTransaction,
  tenantId: string,
  which: "scheduled" | "needsAttention",
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.tenantId, tenantId),
        which === "scheduled" ? isScheduled : needsAttention,
      ),
    );
  return row?.count ?? 0;
}

export interface MediaUsageRow {
  fileCount: number;
  totalBytes: number;
  imageCount: number;
  imagesWithoutAltText: number;
}

export async function summariseMedia(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<MediaUsageRow> {
  const isImage = like(assetsTable.mimeType, "image/%");
  const [row] = await database
    .select({
      fileCount: sql<number>`count(*)`.mapWith(Number),
      totalBytes: sql<number>`coalesce(sum(${assetsTable.size}), 0)`.mapWith(Number),
      imageCount: sql<number>`count(*) filter (where ${isImage})`.mapWith(Number),
      imagesWithoutAltText:
        sql<number>`count(*) filter (where ${isImage} and trim(${assetsTable.alt}) = '')`.mapWith(
          Number,
        ),
    })
    .from(assetsTable)
    .where(eq(assetsTable.tenantId, tenantId));
  return row ?? { fileCount: 0, totalBytes: 0, imageCount: 0, imagesWithoutAltText: 0 };
}
