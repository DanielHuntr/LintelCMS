import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { taxonomiesTable, termsTable } from "../taxonomies/taxonomies.table.js";
import {
  type NewWordPressImportItemRow,
  type WordPressImportItemRow,
  wordpressImportItemsTable,
  type WordPressImportRow,
  wordpressImportsTable,
} from "./wordpress-import.table.js";
import type { WordPressImportStatus } from "./wordpress-import.schema.js";

/** Database reads and writes for WordPress imports, nothing else. */

export async function insertImport(
  database: DatabaseOrTransaction,
  values: typeof wordpressImportsTable.$inferInsert,
): Promise<WordPressImportRow> {
  const [row] = await database.insert(wordpressImportsTable).values(values).returning();
  if (!row) {
    throw new Error("The import could not be recorded.");
  }
  return row;
}

export async function findImport(
  database: DatabaseOrTransaction,
  tenantId: string,
  importId: string,
): Promise<WordPressImportRow | undefined> {
  const [row] = await database
    .select()
    .from(wordpressImportsTable)
    .where(
      and(eq(wordpressImportsTable.tenantId, tenantId), eq(wordpressImportsTable.id, importId)),
    )
    .limit(1);
  return row;
}

export function listImports(database: DatabaseOrTransaction, tenantId: string) {
  return database
    .select()
    .from(wordpressImportsTable)
    .where(eq(wordpressImportsTable.tenantId, tenantId))
    .orderBy(desc(wordpressImportsTable.createdAt));
}

export async function updateImport(
  database: DatabaseOrTransaction,
  importId: string,
  changes: Partial<Omit<typeof wordpressImportsTable.$inferInsert, "id" | "tenantId">>,
): Promise<void> {
  await database
    .update(wordpressImportsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(wordpressImportsTable.id, importId));
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
    .update(wordpressImportsTable)
    .set({ status: "running", lastError: null, updatedAt: new Date() })
    .where(
      and(
        eq(wordpressImportsTable.id, importId),
        inArray(wordpressImportsTable.status, [
          "ready",
          "paused",
        ] satisfies WordPressImportStatus[]),
      ),
    )
    .returning({ id: wordpressImportsTable.id });
  return claimed.length > 0;
}

export async function pauseRunningImports(
  database: DatabaseOrTransaction,
  tenantId: string,
  reason: string,
): Promise<void> {
  await database
    .update(wordpressImportsTable)
    .set({ status: "paused", lastError: reason, updatedAt: new Date() })
    .where(
      and(
        eq(wordpressImportsTable.tenantId, tenantId),
        eq(wordpressImportsTable.status, "running"),
      ),
    );
}

export async function deleteImport(database: DatabaseOrTransaction, importId: string) {
  await database.delete(wordpressImportsTable).where(eq(wordpressImportsTable.id, importId));
}

export async function insertItems(
  database: DatabaseOrTransaction,
  items: NewWordPressImportItemRow[],
): Promise<void> {
  for (let start = 0; start < items.length; start += 500) {
    await database.insert(wordpressImportItemsTable).values(items.slice(start, start + 500));
  }
}

export async function insertItemIfMissing(
  database: DatabaseOrTransaction,
  item: NewWordPressImportItemRow,
): Promise<void> {
  await database.insert(wordpressImportItemsTable).values(item).onConflictDoNothing();
}

export function listItems(database: DatabaseOrTransaction, importId: string) {
  return database
    .select()
    .from(wordpressImportItemsTable)
    .where(eq(wordpressImportItemsTable.importId, importId))
    .orderBy(asc(wordpressImportItemsTable.position));
}

export function listPendingItems(
  database: DatabaseOrTransaction,
  importId: string,
  limit: number,
): Promise<WordPressImportItemRow[]> {
  return database
    .select()
    .from(wordpressImportItemsTable)
    .where(
      and(
        eq(wordpressImportItemsTable.importId, importId),
        eq(wordpressImportItemsTable.status, "pending"),
      ),
    )
    .orderBy(asc(wordpressImportItemsTable.position))
    .limit(limit);
}

export async function finishItem(
  database: DatabaseOrTransaction,
  itemId: string,
  result: Pick<WordPressImportItemRow, "status" | "targetId" | "message" | "details">,
): Promise<void> {
  await database
    .update(wordpressImportItemsTable)
    .set({ ...result, updatedAt: new Date() })
    .where(eq(wordpressImportItemsTable.id, itemId));
}

/** Items listed at upload that are finished; images found in content along the way aren't counted. */
export async function countFinishedItems(
  database: DatabaseOrTransaction,
  importId: string,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(wordpressImportItemsTable)
    .where(
      and(
        eq(wordpressImportItemsTable.importId, importId),
        sql`${wordpressImportItemsTable.status} <> 'pending'`,
        sql`${wordpressImportItemsTable.kind} <> 'image'`,
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
      kind: wordpressImportItemsTable.kind,
      sourceId: wordpressImportItemsTable.sourceId,
      targetId: wordpressImportItemsTable.targetId,
    })
    .from(wordpressImportItemsTable)
    .where(
      and(
        eq(wordpressImportItemsTable.importId, importId),
        inArray(wordpressImportItemsTable.kind, kinds),
        eq(wordpressImportItemsTable.status, "done"),
      ),
    );
  return new Map(
    rows.flatMap((row) => (row.targetId ? [[`${row.kind}:${row.sourceId}`, row.targetId]] : [])),
  );
}

/**
 * The entry an earlier import from the same WordPress site made from this post or page,
 * if that entry is still here. Uploading the same export again then skips it instead of
 * making a copy.
 */
export async function findEntryFromEarlierImport(
  database: DatabaseOrTransaction,
  importId: string,
  siteAddress: string,
  item: { kind: string; sourceId: string },
): Promise<string | undefined> {
  const [row] = await database
    .select({ entryId: entriesTable.id })
    .from(wordpressImportItemsTable)
    .innerJoin(
      wordpressImportsTable,
      eq(wordpressImportsTable.id, wordpressImportItemsTable.importId),
    )
    .innerJoin(entriesTable, eq(entriesTable.id, wordpressImportItemsTable.targetId))
    .where(
      and(
        sql`${wordpressImportsTable.id} <> ${importId}`,
        eq(wordpressImportsTable.siteAddress, siteAddress),
        eq(wordpressImportItemsTable.kind, item.kind),
        eq(wordpressImportItemsTable.sourceId, item.sourceId),
        eq(wordpressImportItemsTable.status, "done"),
      ),
    )
    .limit(1);
  return row?.entryId;
}

export async function findTermInTaxonomy(
  database: DatabaseOrTransaction,
  tenantId: string,
  taxonomyHandle: string,
  slug: string,
) {
  const [row] = await database
    .select({ id: termsTable.id, taxonomyId: taxonomiesTable.id })
    .from(taxonomiesTable)
    .leftJoin(
      termsTable,
      and(eq(termsTable.taxonomyId, taxonomiesTable.id), eq(termsTable.slug, slug)),
    )
    .where(and(eq(taxonomiesTable.tenantId, tenantId), eq(taxonomiesTable.handle, taxonomyHandle)))
    .limit(1);
  return row;
}

export async function insertTerm(
  database: DatabaseOrTransaction,
  term: typeof termsTable.$inferInsert,
): Promise<string> {
  const [row] = await database.insert(termsTable).values(term).returning({ id: termsTable.id });
  if (!row) {
    throw new Error("The term could not be saved.");
  }
  return row.id;
}
