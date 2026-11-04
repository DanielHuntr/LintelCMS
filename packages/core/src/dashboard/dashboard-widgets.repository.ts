import { and, asc, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import { assetsTable as assetsDefinition } from "../media/media.table.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import { countWhere, jsonText } from "../database/dialect/expressions.js";
import { jsonDiffers } from "../database/dialect/json-expressions.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

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
function hasUnpublishedChanges(database: DatabaseOrTransaction) {
  const entriesTable = tableFor(database, entriesDefinition);
  return sql<boolean>`(${entriesTable.publishedData} is not null and ${jsonDiffers(database, entriesTable.data, entriesTable.publishedData)})`.mapWith(
    Boolean,
  );
}

function entryColumns(database: DatabaseOrTransaction) {
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const usersTable = tableFor(database, usersDefinition);
  return {
    id: entriesTable.id,
    title: jsonText(database, entriesTable.data, "title"),
    status: entriesTable.status,
    collectionHandle: collectionsTable.handle,
    collectionName: collectionsTable.name,
    updatedAt: entriesTable.updatedAt,
    scheduledFor: entriesTable.scheduledFor,
    updatedByName: usersTable.name,
    hasUnpublishedChanges: hasUnpublishedChanges(database),
  };
}

function entriesWithCollections(database: DatabaseOrTransaction, tenantId: string) {
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const usersTable = tableFor(database, usersDefinition);
  return database
    .select(entryColumns(database))
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
  const entriesTable = tableFor(database, entriesDefinition);
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
  const entriesTable = tableFor(database, entriesDefinition);
  return entriesWithCollections(database, tenantId)
    .where(and(eq(entriesTable.tenantId, tenantId), eq(entriesTable.updatedBy, userId)))
    .orderBy(desc(entriesTable.updatedAt))
    .limit(limit);
}

function isScheduled(database: DatabaseOrTransaction) {
  const entriesTable = tableFor(database, entriesDefinition);
  return and(eq(entriesTable.status, "scheduled"), isNotNull(entriesTable.scheduledFor));
}

export async function listScheduledEntries(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
): Promise<DashboardEntryRow[]> {
  const entriesTable = tableFor(database, entriesDefinition);
  return entriesWithCollections(database, tenantId)
    .where(and(eq(entriesTable.tenantId, tenantId), isScheduled(database)))
    .orderBy(asc(entriesTable.scheduledFor))
    .limit(limit);
}

/** Drafts, and live entries with saved changes that aren't published yet. */
function needsAttention(database: DatabaseOrTransaction) {
  const entriesTable = tableFor(database, entriesDefinition);
  return or(eq(entriesTable.status, "draft"), hasUnpublishedChanges(database));
}

export async function listEntriesNeedingAttention(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
): Promise<DashboardEntryRow[]> {
  const entriesTable = tableFor(database, entriesDefinition);
  // Oldest first: the ones left longest are the likeliest to have been forgotten.
  return entriesWithCollections(database, tenantId)
    .where(and(eq(entriesTable.tenantId, tenantId), needsAttention(database)))
    .orderBy(asc(entriesTable.updatedAt))
    .limit(limit);
}

export async function countEntries(
  database: DatabaseOrTransaction,
  tenantId: string,
  which: "scheduled" | "needsAttention",
): Promise<number> {
  const entriesTable = tableFor(database, entriesDefinition);
  const [row] = await database
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.tenantId, tenantId),
        which === "scheduled" ? isScheduled(database) : needsAttention(database),
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
  const assetsTable = tableFor(database, assetsDefinition);
  const isImage = like(assetsTable.mimeType, "image/%");
  const [row] = await database
    .select({
      fileCount: sql<number>`count(*)`.mapWith(Number),
      totalBytes: sql<number>`coalesce(sum(${assetsTable.size}), 0)`.mapWith(Number),
      imageCount: countWhere(database, isImage),
      imagesWithoutAltText: countWhere(database, sql`${isImage} and trim(${assetsTable.alt}) = ''`),
    })
    .from(assetsTable)
    .where(eq(assetsTable.tenantId, tenantId));
  return row ?? { fileCount: 0, totalBytes: 0, imageCount: 0, imagesWithoutAltText: 0 };
}
