import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import {
  type NewProductCollectionRow,
  productCollectionItemsTable as productCollectionItemsDefinition,
  type ProductCollectionRow,
  productCollectionsTable as productCollectionsDefinition,
} from "./product-collections.table.js";
import { deleteReturning, insertReturning } from "../../database/dialect/writes.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for product collections and the products picked for them. */

export async function listProductCollectionRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<ProductCollectionRow[]> {
  const productCollectionsTable = tableFor(database, productCollectionsDefinition);
  return database
    .select()
    .from(productCollectionsTable)
    .where(eq(productCollectionsTable.tenantId, tenantId))
    .orderBy(asc(productCollectionsTable.title));
}

export async function findProductCollectionRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  collectionId: string,
): Promise<ProductCollectionRow | undefined> {
  const productCollectionsTable = tableFor(database, productCollectionsDefinition);
  const [row] = await database
    .select()
    .from(productCollectionsTable)
    .where(
      and(
        eq(productCollectionsTable.tenantId, tenantId),
        eq(productCollectionsTable.id, collectionId),
      ),
    )
    .limit(1);
  return row;
}

export async function findProductCollectionRowByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<ProductCollectionRow | undefined> {
  const productCollectionsTable = tableFor(database, productCollectionsDefinition);
  const [row] = await database
    .select()
    .from(productCollectionsTable)
    .where(
      and(
        eq(productCollectionsTable.tenantId, tenantId),
        eq(productCollectionsTable.handle, handle),
      ),
    )
    .limit(1);
  return row;
}

export async function insertProductCollection(
  database: DatabaseOrTransaction,
  collection: NewProductCollectionRow,
): Promise<ProductCollectionRow> {
  const productCollectionsTable = tableFor(database, productCollectionsDefinition);
  const [inserted] = await insertReturning(database, productCollectionsTable, collection);
  if (!inserted) {
    throw new Error("Saving the collection returned nothing");
  }
  return inserted;
}

export async function updateProductCollectionRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  collectionId: string,
  changes: Partial<NewProductCollectionRow>,
): Promise<void> {
  const productCollectionsTable = tableFor(database, productCollectionsDefinition);
  await database
    .update(productCollectionsTable)
    .set(changes)
    .where(
      and(
        eq(productCollectionsTable.tenantId, tenantId),
        eq(productCollectionsTable.id, collectionId),
      ),
    );
}

export async function deleteProductCollectionRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  collectionId: string,
): Promise<boolean> {
  const productCollectionsTable = tableFor(database, productCollectionsDefinition);
  const deleted = await deleteReturning(
    database,
    productCollectionsTable,
    and(
      eq(productCollectionsTable.tenantId, tenantId),
      eq(productCollectionsTable.id, collectionId),
    ),
    { id: productCollectionsTable.id },
  );
  return deleted.length > 0;
}

/** A manual collection's products, in their order. */
export async function listCollectionProductIds(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<string[]> {
  const productCollectionItemsTable = tableFor(database, productCollectionItemsDefinition);
  const rows = await database
    .select({ productId: productCollectionItemsTable.productId })
    .from(productCollectionItemsTable)
    .where(eq(productCollectionItemsTable.collectionId, collectionId))
    .orderBy(asc(productCollectionItemsTable.position));
  return rows.map((row) => row.productId);
}

export async function countCollectionItems(
  database: DatabaseOrTransaction,
  collectionIds: readonly string[],
): Promise<Map<string, number>> {
  const productCollectionItemsTable = tableFor(database, productCollectionItemsDefinition);
  if (collectionIds.length === 0) return new Map();
  const rows = await database
    .select({ collectionId: productCollectionItemsTable.collectionId, value: count() })
    .from(productCollectionItemsTable)
    .where(inArray(productCollectionItemsTable.collectionId, [...collectionIds]))
    .groupBy(productCollectionItemsTable.collectionId);
  return new Map(rows.map((row) => [row.collectionId, row.value]));
}

export async function replaceCollectionItems(
  database: DatabaseOrTransaction,
  tenantId: string,
  collectionId: string,
  productIds: readonly string[],
): Promise<void> {
  const productCollectionItemsTable = tableFor(database, productCollectionItemsDefinition);
  await database
    .delete(productCollectionItemsTable)
    .where(eq(productCollectionItemsTable.collectionId, collectionId));
  if (productIds.length > 0) {
    await database
      .insert(productCollectionItemsTable)
      .values(
        productIds.map((productId, position) => ({ tenantId, collectionId, productId, position })),
      );
  }
}
