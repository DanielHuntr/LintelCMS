import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { collectionsTable } from "../collections/collections.table.js";
import { entriesTable } from "../entries/entries.table.js";
import {
  type NewSiteImportItemRow,
  type SiteImportItemRow,
  siteImportItemsTable,
  type SiteImportRow,
  siteImportsTable,
} from "./site-import.table.js";
import type { SiteImportStatus } from "./site-import.schema.js";

/** Database reads and writes for site imports (Webflow, Framer, Statamic, Umbraco), nothing else. */

export async function insertImport(
  database: DatabaseOrTransaction,
  values: typeof siteImportsTable.$inferInsert,
): Promise<SiteImportRow> {
  const [row] = await database.insert(siteImportsTable).values(values).returning();
  if (!row) {
    throw new Error("The import could not be recorded.");
  }
  return row;
}

export async function findImport(
  database: DatabaseOrTransaction,
  tenantId: string,
  importId: string,
): Promise<SiteImportRow | undefined> {
  const [row] = await database
    .select()
    .from(siteImportsTable)
    .where(and(eq(siteImportsTable.tenantId, tenantId), eq(siteImportsTable.id, importId)))
    .limit(1);
  return row;
}

export function listImports(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select()
    .from(siteImportsTable)
    .where(eq(siteImportsTable.tenantId, tenantId))
    .orderBy(desc(siteImportsTable.createdAt));
}

export async function updateImport(
  database: DatabaseOrTransaction,
  importId: string,
  changes: Partial<Omit<typeof siteImportsTable.$inferInsert, "id" | "tenantId">>,
): Promise<void> {
  await database
    .update(siteImportsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(siteImportsTable.id, importId));
}

/**
 * Moves an import to "running" only if it is ready or paused, in one statement, so two
 * clicks on Start never run it twice. Returns whether this call claimed it.
 */
export async function claimImportToRun(
  database: DatabaseOrTransaction,
  importId: string,
): Promise<boolean> {
  const claimed = await database
    .update(siteImportsTable)
    .set({ status: "running", lastError: null, updatedAt: new Date() })
    .where(
      and(
        eq(siteImportsTable.id, importId),
        inArray(siteImportsTable.status, ["ready", "paused"] satisfies SiteImportStatus[]),
      ),
    )
    .returning({ id: siteImportsTable.id });
  return claimed.length > 0;
}

export async function pauseRunningImports(
  database: DatabaseOrTransaction,
  tenantId: string,
  reason: string,
): Promise<void> {
  await database
    .update(siteImportsTable)
    .set({ status: "paused", lastError: reason, updatedAt: new Date() })
    .where(and(eq(siteImportsTable.tenantId, tenantId), eq(siteImportsTable.status, "running")));
}

export async function deleteImport(database: DatabaseOrTransaction, importId: string) {
  await database.delete(siteImportsTable).where(eq(siteImportsTable.id, importId));
}

export async function insertItems(
  database: DatabaseOrTransaction,
  items: NewSiteImportItemRow[],
): Promise<void> {
  for (let start = 0; start < items.length; start += 500) {
    await database.insert(siteImportItemsTable).values(items.slice(start, start + 500));
  }
}

export async function insertItemIfMissing(
  database: DatabaseOrTransaction,
  item: NewSiteImportItemRow,
): Promise<void> {
  await database.insert(siteImportItemsTable).values(item).onConflictDoNothing();
}

export function listItems(database: DatabaseOrTransaction, importId: string) {
  return database
    .select()
    .from(siteImportItemsTable)
    .where(eq(siteImportItemsTable.importId, importId))
    .orderBy(asc(siteImportItemsTable.position));
}

export function listPendingItems(
  database: DatabaseOrTransaction,
  importId: string,
  limit: number,
): Promise<SiteImportItemRow[]> {
  return database
    .select()
    .from(siteImportItemsTable)
    .where(
      and(eq(siteImportItemsTable.importId, importId), eq(siteImportItemsTable.status, "pending")),
    )
    .orderBy(asc(siteImportItemsTable.position))
    .limit(limit);
}

export async function finishItem(
  database: DatabaseOrTransaction,
  itemId: string,
  result: Pick<SiteImportItemRow, "status" | "targetId" | "message" | "details">,
): Promise<void> {
  await database
    .update(siteImportItemsTable)
    .set({ ...result, updatedAt: new Date() })
    .where(eq(siteImportItemsTable.id, itemId));
}

/** Items that are finished. */
export async function countFinishedItems(
  database: DatabaseOrTransaction,
  importId: string,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(siteImportItemsTable)
    .where(
      and(
        eq(siteImportItemsTable.importId, importId),
        sql`${siteImportItemsTable.status} <> 'pending'`,
      ),
    );
  return Number(row?.count ?? 0);
}

/** Done items of some kinds: what each source id became. */
export async function findTargets(
  database: DatabaseOrTransaction,
  importId: string,
  kinds: string[],
): Promise<Map<string, string>> {
  const rows = await database
    .select({
      kind: siteImportItemsTable.kind,
      sourceId: siteImportItemsTable.sourceId,
      targetId: siteImportItemsTable.targetId,
    })
    .from(siteImportItemsTable)
    .where(
      and(
        eq(siteImportItemsTable.importId, importId),
        inArray(siteImportItemsTable.kind, kinds),
        eq(siteImportItemsTable.status, "done"),
      ),
    );
  return new Map(
    rows.flatMap((row) => (row.targetId ? [[`${row.kind}:${row.sourceId}`, row.targetId]] : [])),
  );
}

/**
 * The entry an earlier import from the same site and system made from this item, if that
 * entry is still here. Uploading the same files again then skips it instead of making a copy.
 */
export async function findEntryFromEarlierImport(
  database: DatabaseOrTransaction,
  importId: string,
  site: { source: string; siteAddress: string },
  item: { kind: string; sourceId: string },
): Promise<string | undefined> {
  const [row] = await database
    .select({ entryId: entriesTable.id })
    .from(siteImportItemsTable)
    .innerJoin(siteImportsTable, eq(siteImportsTable.id, siteImportItemsTable.importId))
    .innerJoin(entriesTable, eq(entriesTable.id, siteImportItemsTable.targetId))
    .where(
      and(
        sql`${siteImportsTable.id} <> ${importId}`,
        eq(siteImportsTable.source, site.source as SiteImportRow["source"]),
        eq(siteImportsTable.siteAddress, site.siteAddress),
        eq(siteImportItemsTable.kind, item.kind),
        eq(siteImportItemsTable.sourceId, item.sourceId),
        eq(siteImportItemsTable.status, "done"),
      ),
    )
    .limit(1);
  return row?.entryId;
}

/** The collections whose entries may sit under one of this collection's. */
export async function findAllowedChildren(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<string[]> {
  const [row] = await database
    .select({ allowedChildren: collectionsTable.allowedChildren })
    .from(collectionsTable)
    .where(eq(collectionsTable.id, collectionId))
    .limit(1);
  return row?.allowedChildren ?? [];
}
