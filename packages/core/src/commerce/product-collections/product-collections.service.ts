import type { Database, DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { firstFreeSlug, slugify } from "../../entries/slugs.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import { listMarketRows } from "../markets/markets.repository.js";
import { listProductRows, listProductRowsById } from "../products/products.repository.js";
import type { ProductRow, ProductStatus } from "../products/products.table.js";
import { collectionRulesCondition } from "./product-collection-rules.js";
import { CollectionHandleTakenError } from "./product-collections.errors.js";
import {
  countCollectionItems,
  deleteProductCollectionRow,
  findProductCollectionRow,
  findProductCollectionRowByHandle,
  insertProductCollection,
  listCollectionProductIds,
  listProductCollectionRows,
  replaceCollectionItems,
  updateProductCollectionRow,
} from "./product-collections.repository.js";
import type {
  ProductCollectionRequest,
  ProductCollectionSummary,
} from "./product-collections.schema.js";
import type { ProductCollectionRow } from "./product-collections.table.js";

/** Groups of products: picked by hand, or every product matching some rules. */

export interface ProductCollectionDetail extends ProductCollectionSummary {
  rules: ProductCollectionRow["rules"];
  matchAll: boolean;
  productIds: string[];
}

export async function listProductCollections(
  database: DatabaseOrTransaction,
): Promise<{ collections: ProductCollectionSummary[] }> {
  const rows = await listProductCollectionRows(database, DEFAULT_TENANT_ID);
  const manualCounts = await countCollectionItems(
    database,
    rows.filter((row) => row.kind === "manual").map((row) => row.id),
  );
  const collections: ProductCollectionSummary[] = [];
  for (const row of rows) {
    const productCount =
      row.kind === "manual"
        ? (manualCounts.get(row.id) ?? 0)
        : (await findCollectionProducts(database, row, undefined, { page: 1, perPage: 1 })).total;
    collections.push({ ...summarise(row), productCount });
  }
  return { collections };
}

export async function findProductCollection(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<ProductCollectionDetail> {
  const row = await findProductCollectionRow(database, DEFAULT_TENANT_ID, collectionId);
  if (!row) {
    throw new ShopRecordNotFoundError("collection");
  }
  return describeCollection(database, row);
}

export async function createProductCollection(
  database: Database,
  request: ProductCollectionRequest,
): Promise<ProductCollectionDetail> {
  const collectionId = await database.transaction(async (transaction) => {
    const handle = await chooseHandle(transaction, request, undefined);
    const row = await insertProductCollection(transaction, {
      tenantId: DEFAULT_TENANT_ID,
      ...columns(request),
      handle,
    });
    await saveItems(transaction, row.id, request);
    return row.id;
  });
  return findProductCollection(database, collectionId);
}

export async function updateProductCollection(
  database: Database,
  collectionId: string,
  request: ProductCollectionRequest,
): Promise<ProductCollectionDetail> {
  const existing = await findProductCollectionRow(database, DEFAULT_TENANT_ID, collectionId);
  if (!existing) {
    throw new ShopRecordNotFoundError("collection");
  }
  await database.transaction(async (transaction) => {
    const handle = await chooseHandle(transaction, request, existing);
    await updateProductCollectionRow(transaction, DEFAULT_TENANT_ID, collectionId, {
      ...columns(request),
      handle,
    });
    await saveItems(transaction, collectionId, request);
  });
  return findProductCollection(database, collectionId);
}

export async function deleteProductCollection(
  database: DatabaseOrTransaction,
  collectionId: string,
): Promise<void> {
  if (!(await deleteProductCollectionRow(database, DEFAULT_TENANT_ID, collectionId))) {
    throw new ShopRecordNotFoundError("collection");
  }
}

export async function findProductCollectionByHandle(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<ProductCollectionRow | undefined> {
  return findProductCollectionRowByHandle(database, DEFAULT_TENANT_ID, handle);
}

/**
 * The products in a collection, a page at a time. Manual collections keep their order;
 * automatic ones list the most recently changed first. `status` limits them, as the
 * storefront does to `active`.
 */
export async function findCollectionProducts(
  database: DatabaseOrTransaction,
  collection: ProductCollectionRow,
  status: ProductStatus | undefined,
  page: { page: number; perPage: number },
): Promise<{ rows: ProductRow[]; total: number }> {
  if (collection.kind === "manual") {
    const orderedIds = await listCollectionProductIds(database, collection.id);
    const products = await listProductRowsById(database, DEFAULT_TENANT_ID, orderedIds);
    const byId = new Map(products.map((product) => [product.id, product]));
    const ordered = orderedIds.flatMap((productId) => {
      const product = byId.get(productId);
      return product && (status === undefined || product.status === status) ? [product] : [];
    });
    const start = (page.page - 1) * page.perPage;
    return { rows: ordered.slice(start, start + page.perPage), total: ordered.length };
  }
  const markets = await listMarketRows(database, DEFAULT_TENANT_ID);
  const primaryCurrency = (markets.find((market) => market.isPrimary) ?? markets[0])?.currency;
  return listProductRows(
    database,
    DEFAULT_TENANT_ID,
    {
      status,
      extraCondition: collectionRulesCondition(
        collection.rules,
        collection.matchAll,
        primaryCurrency ?? null,
      ),
    },
    page,
  );
}

async function describeCollection(
  database: DatabaseOrTransaction,
  row: ProductCollectionRow,
): Promise<ProductCollectionDetail> {
  const productIds =
    row.kind === "manual"
      ? await listCollectionProductIds(database, row.id)
      : (
          await findCollectionProducts(database, row, undefined, { page: 1, perPage: 100 })
        ).rows.map((product) => product.id);
  const total =
    row.kind === "manual"
      ? productIds.length
      : (await findCollectionProducts(database, row, undefined, { page: 1, perPage: 1 })).total;
  return {
    ...summarise(row),
    productCount: total,
    rules: row.rules,
    matchAll: row.matchAll,
    productIds,
  };
}

function summarise(row: ProductCollectionRow): Omit<ProductCollectionSummary, "productCount"> {
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    description: row.description,
    kind: row.kind,
  };
}

function columns(request: ProductCollectionRequest) {
  return {
    title: request.title,
    description: request.description,
    kind: request.kind,
    rules: request.kind === "automatic" ? request.rules : [],
    matchAll: request.matchAll,
  };
}

async function saveItems(
  database: DatabaseOrTransaction,
  collectionId: string,
  request: ProductCollectionRequest,
): Promise<void> {
  if (request.kind === "automatic") {
    await replaceCollectionItems(database, DEFAULT_TENANT_ID, collectionId, []);
    return;
  }
  const unique = [...new Set(request.productIds)];
  const found = await listProductRowsById(database, DEFAULT_TENANT_ID, unique);
  const known = new Set(found.map((product) => product.id));
  await replaceCollectionItems(
    database,
    DEFAULT_TENANT_ID,
    collectionId,
    unique.filter((productId) => known.has(productId)),
  );
}

async function chooseHandle(
  database: DatabaseOrTransaction,
  request: ProductCollectionRequest,
  existing: ProductCollectionRow | undefined,
): Promise<string> {
  const taken = new Set(
    (await listProductCollectionRows(database, DEFAULT_TENANT_ID))
      .filter((row) => row.id !== existing?.id)
      .map((row) => row.handle),
  );
  if (request.handle) {
    if (taken.has(request.handle)) {
      throw new CollectionHandleTakenError(request.handle);
    }
    return request.handle;
  }
  if (existing) {
    return existing.handle;
  }
  return firstFreeSlug(slugify(request.title) || "collection", taken);
}
