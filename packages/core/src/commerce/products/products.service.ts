import type { Database, DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { firstFreeSlug, slugify } from "../../entries/slugs.js";
import type { AssetExists } from "../../fieldtypes/image-assets.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import {
  describeStock,
  listOrCreateLocations,
  setStockLevels,
} from "../inventory/inventory.service.js";
import { listMarketRows } from "../markets/markets.repository.js";
import { checkProduct, variantTitle } from "./product-checks.js";
import type { AdminProduct, AdminProductSummary } from "./product-descriptions.js";
import { describeAdminProduct, describeAdminProductSummary } from "./product-descriptions.js";
import { ProductHandleTakenError, SkuTakenError } from "./products.errors.js";
import {
  deleteProductRow,
  findProductRow,
  findProductRowByHandle,
  findVariantBySku,
  insertProduct,
  insertVariant,
  listHandlesLike,
  listPriceRows,
  listProductRows,
  listProductRowsById,
  listVariantRows,
  replaceVariantPrices,
  updateProductRow,
  updateVariantRow,
  deleteVariantRows,
} from "./products.repository.js";
import type { ListProductsQuery, ProductRequest, VariantRequest } from "./products.schema.js";
import type { ProductRow } from "./products.table.js";

/**
 * The catalogue as staff manage it: making, changing and deleting products. A product is
 * always saved whole, variants, prices and stock included, in one transaction.
 */

export async function listProducts(
  database: DatabaseOrTransaction,
  query: ListProductsQuery,
  now: Date,
): Promise<{ items: AdminProductSummary[]; total: number }> {
  const { rows, total } = await listProductRows(
    database,
    DEFAULT_TENANT_ID,
    { search: query.search, status: query.status },
    query,
  );
  const details = await loadProductDetails(database, rows, now);
  const primaryCurrency = await findPrimaryCurrency(database);
  return {
    items: rows.map((row) => describeAdminProductSummary(row, details, primaryCurrency)),
    total,
  };
}

export async function findProduct(
  database: DatabaseOrTransaction,
  productId: string,
  now: Date,
): Promise<AdminProduct> {
  const row = await findProductRow(database, DEFAULT_TENANT_ID, productId);
  if (!row) {
    throw new ShopRecordNotFoundError("product");
  }
  const details = await loadProductDetails(database, [row], now);
  return describeAdminProduct(row, details);
}

export async function createProduct(
  database: Database,
  request: ProductRequest,
  assetExists: AssetExists,
  now: Date,
): Promise<AdminProduct> {
  await checkProduct(request, await findPrimaryCurrency(database), assetExists);
  const productId = await database.transaction(async (transaction) => {
    const handle = await chooseHandle(transaction, request.handle, request.title, undefined);
    const product = await insertProduct(transaction, {
      tenantId: DEFAULT_TENANT_ID,
      ...productColumns(request),
      handle,
    });
    await saveVariants(transaction, product.id, request.variants, []);
    return product.id;
  });
  return findProduct(database, productId, now);
}

export async function updateProduct(
  database: Database,
  productId: string,
  request: ProductRequest,
  assetExists: AssetExists,
  now: Date,
): Promise<AdminProduct> {
  const existing = await findProductRow(database, DEFAULT_TENANT_ID, productId);
  if (!existing) {
    throw new ShopRecordNotFoundError("product");
  }
  await checkProduct(request, await findPrimaryCurrency(database), assetExists);
  await database.transaction(async (transaction) => {
    const handle = await chooseHandle(transaction, request.handle, request.title, existing);
    await updateProductRow(transaction, DEFAULT_TENANT_ID, productId, {
      ...productColumns(request),
      handle,
    });
    const savedVariantIds = (await listVariantRows(transaction, [productId])).map((row) => row.id);
    await saveVariants(transaction, productId, request.variants, savedVariantIds);
  });
  return findProduct(database, productId, now);
}

/** Orders keep their own copy of what was bought, so deleting a product never changes them. */
export async function deleteProduct(
  database: DatabaseOrTransaction,
  productId: string,
): Promise<void> {
  if (!(await deleteProductRow(database, DEFAULT_TENANT_ID, productId))) {
    throw new ShopRecordNotFoundError("product");
  }
}

/** Variants, prices and stock for a page of products, fetched in three queries. */
export async function loadProductDetails(
  database: DatabaseOrTransaction,
  products: readonly ProductRow[],
  now: Date,
) {
  const variants = await listVariantRows(
    database,
    products.map((product) => product.id),
  );
  const variantIds = variants.map((variant) => variant.id);
  const prices = await listPriceRows(database, variantIds);
  const stock = await describeStock(database, variantIds, now);
  return { variants, prices, stock };
}

export type ProductDetails = Awaited<ReturnType<typeof loadProductDetails>>;

export async function findProductsByIds(
  database: DatabaseOrTransaction,
  productIds: readonly string[],
): Promise<ProductRow[]> {
  return listProductRowsById(database, DEFAULT_TENANT_ID, productIds);
}

async function findPrimaryCurrency(database: DatabaseOrTransaction): Promise<string | null> {
  const markets = await listMarketRows(database, DEFAULT_TENANT_ID);
  return (markets.find((market) => market.isPrimary) ?? markets[0])?.currency ?? null;
}

function productColumns(request: ProductRequest) {
  return {
    title: request.title,
    description: request.description,
    status: request.status,
    vendor: request.vendor,
    productType: request.productType,
    tags: request.tags,
    mediaIds: request.mediaIds,
    seoTitle: request.seoTitle,
    seoDescription: request.seoDescription,
    options: request.options,
  };
}

/** The handle asked for (if free), or one made from the title: "Linen shirt" → linen-shirt. */
async function chooseHandle(
  database: DatabaseOrTransaction,
  requested: string | undefined,
  title: string,
  existing: ProductRow | undefined,
): Promise<string> {
  if (requested) {
    const owner = await findProductRowByHandle(database, DEFAULT_TENANT_ID, requested);
    if (owner && owner.id !== existing?.id) {
      throw new ProductHandleTakenError(requested);
    }
    return requested;
  }
  if (existing) {
    return existing.handle;
  }
  const base = slugify(title) || "product";
  return firstFreeSlug(base, await listHandlesLike(database, DEFAULT_TENANT_ID, base));
}

async function saveVariants(
  database: DatabaseOrTransaction,
  productId: string,
  variants: readonly VariantRequest[],
  savedVariantIds: readonly string[],
): Promise<void> {
  const keptIds = new Set(variants.flatMap((variant) => (variant.id ? [variant.id] : [])));
  // Deleted first, so a SKU can move from a removed variant to a new one in the same save.
  await deleteVariantRows(
    database,
    savedVariantIds.filter((variantId) => !keptIds.has(variantId)),
  );
  const locationIds = new Set(
    (await listOrCreateLocations(database)).map((location) => location.id),
  );

  for (const [position, variant] of variants.entries()) {
    if (variant.sku) {
      await refuseTakenSku(database, variant.sku, variant.id, position);
    }
    const columns = {
      title: variantTitle(variant.optionValues),
      optionValues: variant.optionValues,
      sku: variant.sku,
      barcode: variant.barcode,
      weightGrams: variant.weightGrams,
      inventoryTracked: variant.inventoryTracked,
      position,
    };
    let variantId: string;
    if (variant.id && savedVariantIds.includes(variant.id)) {
      variantId = variant.id;
      await updateVariantRow(database, variantId, columns);
    } else {
      variantId = (
        await insertVariant(database, { tenantId: DEFAULT_TENANT_ID, productId, ...columns })
      ).id;
    }
    await replaceVariantPrices(database, DEFAULT_TENANT_ID, variantId, variant.prices);
    await setStockLevels(
      database,
      variantId,
      variant.stock.filter((level) => locationIds.has(level.locationId)),
    );
  }
}

async function refuseTakenSku(
  database: DatabaseOrTransaction,
  sku: string,
  variantId: string | undefined,
  position: number,
): Promise<void> {
  const owner = await findVariantBySku(database, DEFAULT_TENANT_ID, sku);
  if (owner && owner.id !== variantId) {
    const product = await findProductRow(database, DEFAULT_TENANT_ID, owner.productId);
    throw new SkuTakenError(sku, `variants.${position}.sku`, product?.title ?? "another product");
  }
}
