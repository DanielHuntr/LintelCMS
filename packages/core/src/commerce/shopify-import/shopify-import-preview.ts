import { CUSTOMER_COLUMN_FIELDS } from "./shopify-customers.js";
import type { ShopifyImport } from "./shopify-import.schema.js";
import type { ImportReport, ImportStage, ShopifyImportRow } from "./shopify-import.table.js";
import { imageAddressProblem } from "./shopify-images.js";
import { planCollections } from "./shopify-mapping.js";
import { ORDER_COLUMN_FIELDS } from "./shopify-orders.js";
import { PRODUCT_COLUMN_FIELDS } from "./shopify-products.js";

/** An import as the admin sees it: what's in the files, where each column goes, how far it got. */

export function emptyReport(): ImportReport {
  return {
    products: { created: 0, skipped: 0, failed: 0 },
    collections: { created: 0, skipped: 0, failed: 0 },
    customers: { created: 0, skipped: 0, failed: 0 },
    orders: { created: 0, skipped: 0, failed: 0 },
    images: { downloaded: 0, skipped: 0 },
    problems: [],
    redirects: [],
    productHandles: {},
  };
}

/** How many items each stage works through, with the options chosen. */
export function stageSizes(row: ShopifyImportRow): Record<ImportStage, number> {
  const { plan, options } = row;
  return {
    products: plan.products.length,
    collections: planCollections(plan.products, options).length,
    customers: options.importCustomers ? plan.customers.length : 0,
    orders: options.importOrders ? plan.orders.length : 0,
    done: 0,
  };
}

const FIELD_LISTS = {
  products: PRODUCT_COLUMN_FIELDS,
  customers: CUSTOMER_COLUMN_FIELDS,
  orders: ORDER_COLUMN_FIELDS,
} as const;

export function describeImport(
  row: ShopifyImportRow,
  currency: string | null,
  now: Date,
): ShopifyImport {
  const { plan } = row;
  const sizes = stageSizes(row);
  const order: ImportStage[] = ["products", "collections", "customers", "orders", "done"];
  const stageIndex = order.indexOf(row.stage);
  const done =
    order.slice(0, stageIndex).reduce((sum, stage) => sum + sizes[stage], 0) + row.position;
  const tagCounts = new Map<string, number>();
  for (const product of plan.products) {
    for (const tag of product.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const files = (["products", "customers", "orders"] as const).filter(
    (file) => plan.columns[file].length > 0,
  );
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    done,
    total: Object.values(sizes).reduce((sum, size) => sum + size, 0),
    paused: row.status === "importing" && (!row.leaseUntil || row.leaseUntil < now),
    currency,
    files: {
      products: { rows: plan.products.length },
      customers: plan.columns.customers.length > 0 ? { rows: plan.customers.length } : null,
      orders: plan.columns.orders.length > 0 ? { rows: plan.orders.length } : null,
    },
    counts: {
      products: plan.products.length,
      variants: plan.products.reduce((sum, product) => sum + product.variants.length, 0),
      images: plan.products.reduce((sum, product) => sum + product.images.length, 0),
      customers: plan.customers.length,
      orders: plan.orders.length,
      collectionsInFile: [...new Set(plan.products.flatMap((product) => product.collections))],
      tags: [...tagCounts.entries()]
        .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
        .slice(0, 100)
        .map(([tag, products]) => ({ tag, products })),
    },
    mapping: files.flatMap((file) =>
      plan.columns[file].flatMap((column) => {
        const field = FIELD_LISTS[file][column];
        return field ? [{ file, column, field }] : [];
      }),
    ),
    notImported: files.flatMap((file) =>
      plan.columns[file]
        .filter((column) => !FIELD_LISTS[file][column])
        .map((column) => ({ file, column })),
    ),
    samples: plan.products.slice(0, 5).map((product) => ({
      handle: product.handle,
      title: product.title,
      variants: product.variants.length,
      images: product.images.length,
      price: product.variants[0]?.price ?? "",
      status: product.status,
    })),
    warnings: warningsFor(row),
    options: row.options,
    report: publicReport(row.report),
    dryRunReport: row.dryRunReport ? publicReport(row.dryRunReport) : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/** The report without the handle list kept for the import's own use. */
function publicReport(report: ImportReport): ShopifyImport["report"] {
  return {
    products: report.products,
    collections: report.collections,
    customers: report.customers,
    orders: report.orders,
    images: report.images,
    problems: report.problems,
    redirects: report.redirects,
  };
}

function warningsFor(row: ShopifyImportRow): string[] {
  const { products } = row.plan;
  const warnings: string[] = [];
  const giftCards = products.filter((product) => product.giftCard).length;
  if (giftCards > 0) {
    warnings.push(
      `${giftCards} gift card${giftCards === 1 ? " isn't" : "s aren't"} imported: Lintel doesn't sell gift cards yet.`,
    );
  }
  const offCdn = products
    .flatMap((product) => product.images)
    .filter((image) => imageAddressProblem(image.src) !== null).length;
  if (offCdn > 0) {
    warnings.push(
      `${offCdn} photo${offCdn === 1 ? " isn't" : "s aren't"} on Shopify's image server, so ${offCdn === 1 ? "it" : "they"} will be skipped. Add ${offCdn === 1 ? "it" : "them"} in the product editor afterwards.`,
    );
  }
  const tooMany = products.filter((product) => product.variants.length > 100).length;
  if (tooMany > 0) {
    warnings.push(
      `${tooMany} product${tooMany === 1 ? " has" : "s have"} more than 100 variants, which is Lintel's limit, and won't be imported.`,
    );
  }
  return warnings;
}
