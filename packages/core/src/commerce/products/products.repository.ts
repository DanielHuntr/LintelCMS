import { and, asc, count, desc, eq, ilike, inArray, type SQL } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import {
  type NewProductRow,
  type NewVariantRow,
  type ProductRow,
  type ProductStatus,
  productsTable,
  type VariantPriceRow,
  variantPricesTable,
  type VariantRow,
  variantsTable,
} from "./products.table.js";

/** Database reads and writes for products, their variants and their prices. */

export interface ProductFilter {
  search?: string;
  status?: ProductStatus;
  productIds?: readonly string[];
  extraCondition?: SQL;
}

export async function listProductRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  filter: ProductFilter,
  page: { page: number; perPage: number },
): Promise<{ rows: ProductRow[]; total: number }> {
  const where = productConditions(tenantId, filter);
  const rows = await database
    .select()
    .from(productsTable)
    .where(where)
    .orderBy(desc(productsTable.updatedAt), asc(productsTable.id))
    .limit(page.perPage)
    .offset((page.page - 1) * page.perPage);
  const [total] = await database.select({ value: count() }).from(productsTable).where(where);
  return { rows, total: total?.value ?? 0 };
}

export async function listProductRowsById(
  database: DatabaseOrTransaction,
  tenantId: string,
  productIds: readonly string[],
): Promise<ProductRow[]> {
  if (productIds.length === 0) return [];
  return database
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.tenantId, tenantId), inArray(productsTable.id, [...productIds])));
}

export async function findProductRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  productId: string,
): Promise<ProductRow | undefined> {
  const [row] = await database
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.id, productId)))
    .limit(1);
  return row;
}

export async function findProductRowByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<ProductRow | undefined> {
  const [row] = await database
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.handle, handle)))
    .limit(1);
  return row;
}

/** Handles starting with `base`, for picking a free one ("shirt", "shirt-2"). */
export async function listHandlesLike(
  database: DatabaseOrTransaction,
  tenantId: string,
  base: string,
): Promise<Set<string>> {
  const rows = await database
    .select({ handle: productsTable.handle })
    .from(productsTable)
    .where(and(eq(productsTable.tenantId, tenantId), ilike(productsTable.handle, `${base}%`)));
  return new Set(rows.map((row) => row.handle));
}

export async function insertProduct(
  database: DatabaseOrTransaction,
  product: NewProductRow,
): Promise<ProductRow> {
  const [inserted] = await database.insert(productsTable).values(product).returning();
  if (!inserted) {
    throw new Error("Saving the product returned nothing");
  }
  return inserted;
}

export async function updateProductRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  productId: string,
  changes: Partial<NewProductRow>,
): Promise<void> {
  await database
    .update(productsTable)
    .set(changes)
    .where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.id, productId)));
}

export async function deleteProductRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  productId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(productsTable)
    .where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.id, productId)))
    .returning({ id: productsTable.id });
  return deleted.length > 0;
}

export async function listVariantRows(
  database: DatabaseOrTransaction,
  productIds: readonly string[],
): Promise<VariantRow[]> {
  if (productIds.length === 0) return [];
  return database
    .select()
    .from(variantsTable)
    .where(inArray(variantsTable.productId, [...productIds]))
    .orderBy(asc(variantsTable.position), asc(variantsTable.createdAt));
}

export async function listVariantRowsById(
  database: DatabaseOrTransaction,
  tenantId: string,
  variantIds: readonly string[],
): Promise<VariantRow[]> {
  if (variantIds.length === 0) return [];
  return database
    .select()
    .from(variantsTable)
    .where(and(eq(variantsTable.tenantId, tenantId), inArray(variantsTable.id, [...variantIds])));
}

export async function insertVariant(
  database: DatabaseOrTransaction,
  variant: NewVariantRow,
): Promise<VariantRow> {
  const [inserted] = await database.insert(variantsTable).values(variant).returning();
  if (!inserted) {
    throw new Error("Saving the variant returned nothing");
  }
  return inserted;
}

export async function updateVariantRow(
  database: DatabaseOrTransaction,
  variantId: string,
  changes: Partial<NewVariantRow>,
): Promise<void> {
  await database.update(variantsTable).set(changes).where(eq(variantsTable.id, variantId));
}

export async function deleteVariantRows(
  database: DatabaseOrTransaction,
  variantIds: readonly string[],
): Promise<void> {
  if (variantIds.length === 0) return;
  await database.delete(variantsTable).where(inArray(variantsTable.id, [...variantIds]));
}

/** The variant that already uses a SKU, if any; SKUs are unique across the shop. */
export async function findVariantBySku(
  database: DatabaseOrTransaction,
  tenantId: string,
  sku: string,
): Promise<VariantRow | undefined> {
  const [row] = await database
    .select()
    .from(variantsTable)
    .where(and(eq(variantsTable.tenantId, tenantId), eq(variantsTable.sku, sku)))
    .limit(1);
  return row;
}

export async function listPriceRows(
  database: DatabaseOrTransaction,
  variantIds: readonly string[],
): Promise<VariantPriceRow[]> {
  if (variantIds.length === 0) return [];
  return database
    .select()
    .from(variantPricesTable)
    .where(inArray(variantPricesTable.variantId, [...variantIds]));
}

export async function replaceVariantPrices(
  database: DatabaseOrTransaction,
  tenantId: string,
  variantId: string,
  prices: ReadonlyArray<{ currency: string; amount: number; compareAtAmount: number | null }>,
): Promise<void> {
  await database.delete(variantPricesTable).where(eq(variantPricesTable.variantId, variantId));
  if (prices.length > 0) {
    await database
      .insert(variantPricesTable)
      .values(prices.map((price) => ({ tenantId, variantId, ...price })));
  }
}

function productConditions(tenantId: string, filter: ProductFilter): SQL | undefined {
  const escaped = filter.search?.replace(/[\\%_]/g, (character) => `\\${character}`);
  return and(
    eq(productsTable.tenantId, tenantId),
    filter.status ? eq(productsTable.status, filter.status) : undefined,
    escaped ? ilike(productsTable.title, `%${escaped}%`) : undefined,
    filter.productIds ? inArray(productsTable.id, [...filter.productIds]) : undefined,
    filter.extraCondition,
  );
}
