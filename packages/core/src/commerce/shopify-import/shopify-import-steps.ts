import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { AssetExists } from "../../fieldtypes/image-assets.js";
import { HttpError } from "../../http/http-errors.js";
import { uploadAsset } from "../../media/media.service.js";
import type { ShopContext } from "../commerce.context.js";
import { createProductCollection } from "../product-collections/product-collections.service.js";
import { findProductCollectionByHandle } from "../product-collections/product-collections.service.js";
import { findProductRowByHandle, findVariantBySku } from "../products/products.repository.js";
import { createProduct } from "../products/products.service.js";
import {
  archivedOrderExists,
  findCustomerIdByEmail,
  insertArchivedOrderIfNew,
  insertCustomerIfNew,
} from "./shopify-import.repository.js";
import type { ImportOptions, ImportReport, ImportStage } from "./shopify-import.table.js";
import { downloadShopifyImage, imageAddressProblem } from "./shopify-images.js";
import {
  mapArchivedOrder,
  mapCustomer,
  mapProduct,
  type PlannedCollection,
} from "./shopify-mapping.js";
import type { ShopifyCustomer } from "./shopify-customers.js";
import type { ShopifyOrder } from "./shopify-orders.js";
import type { ShopifyProduct } from "./shopify-products.js";

/**
 * Bringing in one item of each kind. Each step is safe to repeat: something already in the
 * shop (by product handle, collection handle, customer email or order name) is skipped,
 * which is what lets an interrupted import carry on. With `dryRun` nothing is saved or
 * downloaded, but every check still runs, so the dry run's report says what would happen.
 */
export interface StepContext {
  shop: ShopContext;
  options: ImportOptions;
  report: ImportReport;
  /** The primary market's currency: Shopify's export has prices but not their currency. */
  currency: string;
  locationId: string;
  assetExists: AssetExists;
  /** Who is running the import, recorded on the photos it saves. */
  userId: string;
  dryRun: boolean;
}

const MAX_PROBLEMS = 500;

export function noteProblem(
  report: ImportReport,
  stage: ImportStage,
  item: string,
  message: string,
): void {
  if (report.problems.length < MAX_PROBLEMS) report.problems.push({ stage, item, message });
}

export async function importProduct(context: StepContext, product: ShopifyProduct): Promise<void> {
  const { shop, report } = context;
  const mapped = mapProduct(product, context.options, context);
  if (!mapped.ok) {
    report.products[product.giftCard ? "skipped" : "failed"] += 1;
    noteProblem(report, "products", product.handle, mapped.message);
    return;
  }
  const request = mapped.value;
  const handle = request.handle ?? product.handle;
  if (await findProductRowByHandle(shop.database, DEFAULT_TENANT_ID, handle)) {
    report.products.skipped += 1;
    report.productHandles[product.handle] = handle;
    noteProblem(
      report,
      "products",
      product.handle,
      "Already in your shop, so it was left as it is.",
    );
    return;
  }
  for (const variant of request.variants) {
    if (variant.sku && (await findVariantBySku(shop.database, DEFAULT_TENANT_ID, variant.sku))) {
      report.products.failed += 1;
      noteProblem(
        report,
        "products",
        product.handle,
        `The SKU ${variant.sku} is already used by another product.`,
      );
      return;
    }
  }
  const mediaIds = context.options.importImages ? await importImages(context, product) : [];
  if (context.dryRun) {
    report.products.created += 1;
    report.productHandles[product.handle] = handle;
    return;
  }
  try {
    const created = await createProduct(
      shop.database,
      { ...request, mediaIds },
      context.assetExists,
      shop.now(),
    );
    report.products.created += 1;
    report.productHandles[product.handle] = created.handle;
    const toPath = `${context.options.productPathPrefix}${created.handle}`;
    const fromPath = `/products/${product.handle}`;
    if (fromPath !== toPath) report.redirects.push({ fromPath, toPath });
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    report.products.failed += 1;
    noteProblem(report, "products", product.handle, error.message);
  }
}

async function importImages(context: StepContext, product: ShopifyProduct): Promise<string[]> {
  const { report } = context;
  const mediaIds: string[] = [];
  for (const image of product.images.slice(0, 50)) {
    const problem = imageAddressProblem(image.src);
    if (problem) {
      report.images.skipped += 1;
      noteProblem(report, "products", product.handle, `A photo was skipped: it ${problem}.`);
      continue;
    }
    if (context.dryRun) {
      report.images.downloaded += 1;
      continue;
    }
    const download = await downloadShopifyImage(context.shop.importFetch, image.src);
    if (!download.ok) {
      report.images.skipped += 1;
      noteProblem(report, "products", product.handle, `A photo was skipped: ${download.reason}.`);
      continue;
    }
    try {
      const { asset } = await uploadAsset(
        context.shop.mediaLibrary(),
        { filename: download.filename, contents: download.contents },
        context.userId,
      );
      if (!mediaIds.includes(asset.id)) mediaIds.push(asset.id);
      report.images.downloaded += 1;
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      report.images.skipped += 1;
      noteProblem(report, "products", product.handle, `A photo was skipped: ${error.message}`);
    }
  }
  return mediaIds;
}

export async function importCollection(
  context: StepContext,
  collection: PlannedCollection,
): Promise<void> {
  const { shop, report } = context;
  if (await findProductCollectionByHandle(shop.database, collection.handle)) {
    report.collections.skipped += 1;
    noteProblem(
      report,
      "collections",
      collection.title,
      "A collection with this address is already in your shop.",
    );
    return;
  }
  if (context.dryRun) {
    report.collections.created += 1;
    return;
  }
  const productIds: string[] = [];
  for (const shopifyHandle of collection.productHandles) {
    const handle = report.productHandles[shopifyHandle];
    const product = handle
      ? await findProductRowByHandle(shop.database, DEFAULT_TENANT_ID, handle)
      : undefined;
    if (product && !productIds.includes(product.id)) productIds.push(product.id);
  }
  await createProductCollection(shop.database, {
    title: collection.title.slice(0, 200),
    handle: collection.handle.slice(0, 80),
    description: "",
    kind: collection.kind,
    rules: collection.tag ? [{ field: "tag", operator: "equals", value: collection.tag }] : [],
    matchAll: true,
    productIds,
  });
  report.collections.created += 1;
}

export async function importCustomer(
  context: StepContext,
  customer: ShopifyCustomer,
): Promise<void> {
  const { shop, report } = context;
  const mapped = mapCustomer(customer);
  if (!mapped.ok) {
    report.customers.failed += 1;
    noteProblem(report, "customers", customer.name || "A customer", mapped.message);
    return;
  }
  if (context.dryRun) {
    const exists = await findCustomerIdByEmail(shop.database, mapped.value.email);
    report.customers[exists ? "skipped" : "created"] += 1;
    return;
  }
  const created = await insertCustomerIfNew(shop.database, mapped.value);
  report.customers[created ? "created" : "skipped"] += 1;
}

export async function importOrder(context: StepContext, order: ShopifyOrder): Promise<void> {
  const { shop, report } = context;
  const mapped = mapArchivedOrder(order);
  if (!mapped.ok) {
    report.orders.failed += 1;
    noteProblem(report, "orders", order.name, mapped.message);
    return;
  }
  if (context.dryRun) {
    report.orders[(await archivedOrderExists(shop.database, order.name)) ? "skipped" : "created"] +=
      1;
    return;
  }
  const customerId = order.email ? await findCustomerIdByEmail(shop.database, order.email) : null;
  const created = await insertArchivedOrderIfNew(shop.database, { ...mapped.value, customerId });
  report.orders[created ? "created" : "skipped"] += 1;
}
