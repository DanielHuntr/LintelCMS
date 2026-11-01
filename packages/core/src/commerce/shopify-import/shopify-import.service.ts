import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { AssetExists } from "../../fieldtypes/image-assets.js";
import { findRedirectFrom, insertRedirect } from "../../seo/redirects.repository.js";
import { isSeoPluginEnabled } from "../../seo/seo-plugin.js";
import type { ShopContext } from "../commerce.context.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import { listOrCreateLocations } from "../inventory/inventory.service.js";
import { listMarketRows } from "../markets/markets.repository.js";
import { NoMarketsError } from "../markets/markets.errors.js";
import { CsvFormatError, parseCsv } from "./csv.js";
import { readShopifyCustomers } from "./shopify-customers.js";
import {
  ImportAlreadyStartedError,
  ImportBusyError,
  ImportFileError,
} from "./shopify-import.errors.js";
import { describeImport, emptyReport, stageSizes } from "./shopify-import-preview.js";
import {
  claimImport,
  findImportRow,
  insertImport,
  listImportRows,
  updateImportRow,
} from "./shopify-import.repository.js";
import type {
  ImportOptionsRequest,
  ShopifyImport,
  StartImportRequest,
} from "./shopify-import.schema.js";
import {
  importCollection,
  importCustomer,
  importOrder,
  importProduct,
  type StepContext,
} from "./shopify-import-steps.js";
import type { ImportStage, ShopifyImportRow } from "./shopify-import.table.js";
import { planCollections } from "./shopify-mapping.js";
import { readShopifyOrders } from "./shopify-orders.js";
import { readShopifyProducts } from "./shopify-products.js";

/**
 * Moving a shop from Shopify, from its admin's CSV exports: no Shopify login or API key.
 *
 *   1. the files are read and kept as a plan (`startImport`), shown as a preview and mapping
 *   2. the shop owner picks what to bring (`updateImportOptions`) and can try a dry run
 *   3. the admin calls `runImportBatch` again and again; each call does a few seconds' work
 *      and saves where it got to, so progress shows and an interruption loses nothing
 *   4. the final report lists what came in, what didn't and why, and redirects to add
 */

/** Each batch stops after this long, so a request never runs into a proxy's time limit. */
const BATCH_MILLISECONDS = 5_000;
const LEASE_MILLISECONDS = 60_000;
const STAGES: ImportStage[] = ["products", "collections", "customers", "orders", "done"];

export async function startImport(
  shop: ShopContext,
  request: StartImportRequest,
  userId: string,
): Promise<ShopifyImport> {
  const products = readFile("productsCsv", request.productsCsv, "Handle", "products");
  const customers = request.customersCsv
    ? readFile("customersCsv", request.customersCsv, "Email", "customers")
    : null;
  const orders = request.ordersCsv
    ? readFile("ordersCsv", request.ordersCsv, "Name", "orders")
    : null;
  const plan = {
    products: readShopifyProducts(products),
    customers: customers ? readShopifyCustomers(customers) : [],
    orders: orders ? readShopifyOrders(orders) : [],
    columns: {
      products: products.columns,
      customers: customers?.columns ?? [],
      orders: orders?.columns ?? [],
    },
  };
  const row = await insertImport(shop.database, {
    plan,
    options: {
      productStatus: "keep",
      importImages: true,
      collectionsFromColumn: products.columns.includes("Collection"),
      tagCollections: [],
      importCustomers: plan.customers.length > 0,
      importOrders: plan.orders.length > 0,
      productPathPrefix: "/products/",
    },
    report: emptyReport(),
    createdBy: userId,
  });
  return describe(shop, row);
}

export async function listImports(shop: ShopContext): Promise<{ imports: ShopifyImport[] }> {
  const rows = await listImportRows(shop.database);
  const currency = await primaryCurrency(shop.database);
  return { imports: rows.map((row) => describeImport(row, currency, shop.now())) };
}

export async function findImport(shop: ShopContext, importId: string): Promise<ShopifyImport> {
  return describe(shop, await loadImport(shop, importId));
}

export async function updateImportOptions(
  shop: ShopContext,
  importId: string,
  options: ImportOptionsRequest,
): Promise<ShopifyImport> {
  const row = await loadImport(shop, importId);
  if (row.status !== "ready") throw new ImportAlreadyStartedError();
  await updateImportRow(shop.database, importId, { options, dryRunReport: null });
  return findImport(shop, importId);
}

/** Runs every check without saving anything, and keeps the report to show. */
export async function dryRunImport(
  shop: ShopContext,
  importId: string,
  people: { userId: string; assetExists: AssetExists },
): Promise<ShopifyImport> {
  const row = await loadImport(shop, importId);
  const context = await stepContext(shop, row, people, true);
  for (const stage of STAGES) {
    for (let position = 0; position < stageSizes(row)[stage]; position++) {
      await runStep(context, row, stage, position);
    }
  }
  await updateImportRow(shop.database, importId, { dryRunReport: context.report });
  return findImport(shop, importId);
}

/**
 * Does a few seconds' work and saves where it got to after every item. Calling it again
 * carries on; once everything is through, the import is completed.
 */
export async function runImportBatch(
  shop: ShopContext,
  importId: string,
  people: { userId: string; assetExists: AssetExists },
  maxItems = Number.POSITIVE_INFINITY,
): Promise<ShopifyImport> {
  const found = await loadImport(shop, importId);
  if (found.status === "completed") return describe(shop, found);
  const startedAt = Date.now();
  const now = shop.now();
  const row = await claimImport(
    shop.database,
    importId,
    now,
    new Date(now.getTime() + LEASE_MILLISECONDS),
  );
  if (!row) throw new ImportBusyError();
  const context = await stepContext(shop, row, people, false);
  const sizes = stageSizes(row);
  let { stage, position } = row;
  let itemsDone = 0;
  try {
    while (
      stage !== "done" &&
      Date.now() - startedAt < BATCH_MILLISECONDS &&
      itemsDone < maxItems
    ) {
      if (position >= sizes[stage]) {
        stage = STAGES[STAGES.indexOf(stage) + 1] ?? "done";
        position = 0;
      } else {
        await runStep(context, row, stage, position);
        position += 1;
        itemsDone += 1;
      }
      await updateImportRow(shop.database, importId, {
        status: "importing",
        stage,
        position,
        report: context.report,
      });
    }
    if (stage === "done") {
      await suggestRedirects(shop, context);
      await updateImportRow(shop.database, importId, { status: "completed", completedAt: now });
    }
  } finally {
    await updateImportRow(shop.database, importId, { leaseUntil: null });
  }
  return findImport(shop, importId);
}

async function runStep(
  context: StepContext,
  row: ShopifyImportRow,
  stage: ImportStage,
  position: number,
): Promise<void> {
  const { plan, options } = row;
  if (stage === "products") {
    const product = plan.products[position];
    if (product) await importProduct(context, product);
  } else if (stage === "collections") {
    const collection = planCollections(plan.products, options)[position];
    if (collection) await importCollection(context, collection);
  } else if (stage === "customers") {
    const customer = plan.customers[position];
    if (customer) await importCustomer(context, customer);
  } else if (stage === "orders") {
    const order = plan.orders[position];
    if (order) await importOrder(context, order);
  }
}

/**
 * With the SEO plugin on, every product whose address changes gets a suggested redirect in
 * Settings → Redirects, waiting for a person to accept it. They're in the report either way.
 */
async function suggestRedirects(shop: ShopContext, context: StepContext): Promise<void> {
  if (!(await isSeoPluginEnabled(shop.database))) return;
  for (const redirect of context.report.redirects) {
    if (await findRedirectFrom(shop.database, DEFAULT_TENANT_ID, redirect.fromPath)) continue;
    await insertRedirect(shop.database, {
      tenantId: DEFAULT_TENANT_ID,
      fromPath: redirect.fromPath,
      toPath: redirect.toPath,
      statusCode: 301,
      status: "suggested",
      source: "import",
    });
  }
}

async function stepContext(
  shop: ShopContext,
  row: ShopifyImportRow,
  people: { userId: string; assetExists: AssetExists },
  dryRun: boolean,
): Promise<StepContext> {
  const currency = await primaryCurrency(shop.database);
  if (!currency) throw new NoMarketsError();
  const [location] = await listOrCreateLocations(shop.database);
  if (!location) throw new Error("listOrCreateLocations always returns a location");
  return {
    shop,
    options: row.options,
    report: dryRun ? emptyReport() : structuredClone(row.report),
    currency,
    locationId: location.id,
    assetExists: people.assetExists,
    userId: people.userId,
    dryRun,
  };
}

function readFile(
  file: "productsCsv" | "customersCsv" | "ordersCsv",
  text: string,
  requiredColumn: string,
  kind: string,
) {
  let table;
  try {
    table = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvFormatError) throw new ImportFileError(file, error.message);
    throw error;
  }
  if (!table.columns.includes(requiredColumn)) {
    throw new ImportFileError(
      file,
      `This doesn't look like Shopify's ${kind} export: it has no “${requiredColumn}” column. In Shopify, open ${kind[0]?.toUpperCase()}${kind.slice(1)} and choose Export.`,
    );
  }
  return table;
}

async function loadImport(shop: ShopContext, importId: string): Promise<ShopifyImportRow> {
  const row = await findImportRow(shop.database, importId);
  if (!row) throw new ShopRecordNotFoundError("import");
  return row;
}

async function describe(shop: ShopContext, row: ShopifyImportRow): Promise<ShopifyImport> {
  return describeImport(row, await primaryCurrency(shop.database), shop.now());
}

async function primaryCurrency(database: DatabaseOrTransaction): Promise<string | null> {
  const markets = await listMarketRows(database, DEFAULT_TENANT_ID);
  return (markets.find((market) => market.isPrimary) ?? markets[0])?.currency ?? null;
}
