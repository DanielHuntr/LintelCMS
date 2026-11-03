import { and, asc, eq, or, sql } from "drizzle-orm";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import type { EntryData } from "../entries/entries.table.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { type BlockRow, blocksTable, type NewBlockRow } from "./blocks.table.js";

/** Database reads and writes for blocks, and the entries that may hold their instances. */

export async function listBlockRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<BlockRow[]> {
  return database
    .select()
    .from(blocksTable)
    .where(eq(blocksTable.tenantId, tenantId))
    .orderBy(asc(blocksTable.category), asc(blocksTable.name));
}

export async function findBlockRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<BlockRow | undefined> {
  const [row] = await database
    .select()
    .from(blocksTable)
    .where(and(eq(blocksTable.tenantId, tenantId), eq(blocksTable.handle, handle)))
    .limit(1);
  return row;
}

/** Inserts the block unless one with its handle exists; returns undefined if it did. */
export async function insertBlockIfMissing(
  database: DatabaseOrTransaction,
  block: NewBlockRow,
): Promise<BlockRow | undefined> {
  const [inserted] = await database
    .insert(blocksTable)
    .values(block)
    .onConflictDoNothing({ target: [blocksTable.tenantId, blocksTable.handle] })
    .returning();
  return inserted;
}

export async function updateBlockRow(
  database: DatabaseOrTransaction,
  blockId: string,
  changes: Partial<Omit<NewBlockRow, "id" | "tenantId" | "handle">>,
): Promise<void> {
  await database
    .update(blocksTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(blocksTable.id, blockId));
}

export async function deleteBlockRow(database: DatabaseOrTransaction, blockId: string) {
  await database.delete(blocksTable).where(eq(blocksTable.id, blockId));
}

export interface EntryWithBlocks {
  id: string;
  title: string | null;
  slug: string;
  collection: string;
  data: EntryData;
  publishedData: EntryData | null;
}

/**
 * Entries whose saved or published values mention `text` (a block's handle in quotes), as
 * a cheap first look; callers check the values properly.
 */
export async function listEntriesMentioning(
  database: DatabaseOrTransaction,
  tenantId: string,
  text: string,
): Promise<EntryWithBlocks[]> {
  const quoted = `%${text}%`;
  return database
    .select({
      id: entriesTable.id,
      title: sql<string | null>`${entriesTable.data}->>'title'`,
      slug: entriesTable.slug,
      collection: collectionsTable.handle,
      data: entriesTable.data,
      publishedData: entriesTable.publishedData,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        eq(entriesTable.tenantId, tenantId),
        or(
          sql`${entriesTable.data}::text like ${quoted}`,
          sql`${entriesTable.publishedData}::text like ${quoted}`,
        ),
      ),
    )
    .orderBy(asc(entriesTable.createdAt));
}

/** Writes an entry's values back after its instances changed, without a new revision. */
export async function updateEntryValues(
  database: DatabaseOrTransaction,
  entryId: string,
  values: { data: EntryData; publishedData: EntryData | null },
): Promise<void> {
  await database.update(entriesTable).set(values).where(eq(entriesTable.id, entryId));
}

/** Each collection's handle with its blueprint's fields, to find blocks fields' blocks. */
export async function listCollectionFields(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<{ handle: string; fields: FieldDefinition[] }[]> {
  return database
    .select({ handle: collectionsTable.handle, fields: blueprintsTable.fields })
    .from(collectionsTable)
    .innerJoin(blueprintsTable, eq(blueprintsTable.id, collectionsTable.blueprintId))
    .where(eq(collectionsTable.tenantId, tenantId));
}
