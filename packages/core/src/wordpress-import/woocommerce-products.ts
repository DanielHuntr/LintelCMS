import type { Database } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { slugify } from "../entries/slugs.js";
import { HttpError } from "../http/http-errors.js";
import { isPluginEnabled } from "../plugins/plugins.service.js";
import { listOrCreateLocations } from "../commerce/inventory/inventory.service.js";
import { listMarketRows } from "../commerce/markets/markets.repository.js";
import { fromDecimalAmount } from "../commerce/payments/provider-amounts.js";
import { findProductRowByHandle } from "../commerce/products/products.repository.js";
import { productRequestSchema, type ProductRequest } from "../commerce/products/products.schema.js";
import { createProduct } from "../commerce/products/products.service.js";
import { findRedirectFrom, insertRedirect } from "../seo/redirects.repository.js";
import { normaliseRedirectPath } from "../seo/redirects.schema.js";
import { splitWordPressContent } from "./wordpress-content.js";
import {
  done,
  failed,
  type ItemContext,
  type ItemResult,
  skipped,
} from "./wordpress-import-context.js";
import { piecesToRichText } from "./wordpress-rich-text.js";
import type { WooCommerceProduct, WooCommerceStock } from "./woocommerce-reader.js";

/**
 * A WooCommerce product becomes a product in the shop, the same way a Shopify one does:
 * title, description, photos, options (from its attributes) and one variant per
 * variation, each with its SKU, price (a sale price is the price, the regular one the
 * "compare at" price), weight and stock. Product categories and tags become tags.
 *
 * The shop has to be switched on and have a market, since prices need a currency; the
 * export has amounts but not their currency, so the main market's is used.
 *
 * Saving a product opens a transaction of its own, so products are saved outside the
 * item's transaction (`database` is the server's database here).
 */
export async function importWooCommerceProduct(
  context: ItemContext,
  product: WooCommerceProduct,
): Promise<ItemResult> {
  const database = context.serverDatabase;
  if (context.mapping.products === "skip") {
    return skipped("Products were left out on the mapping screen.");
  }
  if (!(await isPluginEnabled(context.database, "commerce"))) {
    return skipped("The online shop is switched off. Switch it on in Build → Features first.");
  }
  if (product.status === "trash") {
    return skipped("It was in the WordPress bin.");
  }
  const markets = await listMarketRows(context.database, DEFAULT_TENANT_ID);
  const currency = (markets.find((market) => market.isPrimary) ?? markets[0])?.currency;
  if (!currency) {
    return failed("The shop has no market yet, so prices have no currency. Add one first.");
  }
  const [location] = await listOrCreateLocations(context.database);
  if (!location) {
    return failed("The shop has nowhere to keep stock.");
  }
  const mapped = mapProduct(context, product, currency, location.id);
  if ("problem" in mapped) {
    return failed(mapped.problem);
  }
  const request = mapped.request;
  const handle = request.handle ?? slugify(product.title);
  if (await findProductRowByHandle(context.database, DEFAULT_TENANT_ID, handle)) {
    return skipped(
      `The shop already has a product at /products/${handle}, so it was left as it is.`,
    );
  }
  if (context.dryRun) {
    return done(location.id, { title: product.title });
  }
  try {
    const created = await createProduct(database, request, context.assetExists, new Date());
    const redirected = await suggestProductRedirect(context, database, product.link, created);
    return done(created.id, { title: product.title, redirected });
  } catch (error) {
    if (error instanceof HttpError) {
      return failed(error.message);
    }
    throw error;
  }
}

function mapProduct(
  context: ItemContext,
  product: WooCommerceProduct,
  currency: string,
  locationId: string,
): { request: ProductRequest } | { problem: string } {
  const isVariable = product.productType === "variable" && product.variations.length > 0;
  if (!["simple", "variable"].includes(product.productType)) {
    return {
      problem: `${product.productType} products (such as grouped or external ones) aren't brought in yet.`,
    };
  }
  const variants: ProductRequest["variants"] = [];
  const stocks = isVariable ? product.variations : [{ ...product.stock, optionValues: [] }];
  for (const stock of stocks) {
    const prices = priceOf(stock, currency);
    if ("problem" in prices) {
      return prices;
    }
    variants.push({
      optionValues: stock.optionValues,
      sku: stock.sku || null,
      barcode: null,
      weightGrams: gramsOf(stock.weight),
      inventoryTracked: stock.managed,
      prices: [{ currency, ...prices }],
      stock: stock.managed ? [{ locationId, onHand: stock.quantity }] : [],
    });
  }
  const options = isVariable
    ? product.optionNames.map((name, index) => ({
        name,
        values: [...new Set(variants.map((variant) => variant.optionValues[index] ?? "Any"))],
      }))
    : [];
  const mediaIds = product.imageIds.flatMap(
    (imageId) => context.targets.get(`attachment:${imageId}`) ?? [],
  );
  const parsed = productRequestSchema.safeParse({
    title: product.title,
    handle: slugify(product.slug) || slugify(product.title) || undefined,
    description: product.content.trim()
      ? piecesToRichText(splitWordPressContent(product.content), () => null).document
      : null,
    status: product.status === "publish" ? "active" : "draft",
    tags: [...product.categories, ...product.tags].map((tag) => tag.slice(0, 50)).slice(0, 50),
    mediaIds: context.dryRun ? [] : [...new Set(mediaIds)],
    options,
    variants,
  });
  if (!parsed.success) {
    return { problem: parsed.error.issues[0]?.message ?? "This product couldn't be read." };
  }
  return { request: parsed.data };
}

type Price = { amount: number; compareAtAmount: number | null } | { problem: string };

function priceOf(stock: WooCommerceStock, currency: string): Price {
  const regular = fromDecimalAmount(stock.regularPrice || "0", currency);
  const sale = stock.salePrice ? fromDecimalAmount(stock.salePrice, currency) : null;
  if (regular === null) {
    return { problem: `The price “${stock.regularPrice}” isn't an amount in ${currency}.` };
  }
  if (sale !== null && sale < regular) {
    return { amount: sale, compareAtAmount: regular };
  }
  return { amount: regular, compareAtAmount: null };
}

/** WooCommerce weights are in the shop's unit, which the export doesn't say; kilograms is its default. */
function gramsOf(weight: string): number {
  const kilograms = Number.parseFloat(weight);
  return Number.isFinite(kilograms) && kilograms > 0 ? Math.round(kilograms * 1000) : 0;
}

async function suggestProductRedirect(
  context: ItemContext,
  database: Database,
  oldAddress: string,
  created: { id: string; handle: string },
): Promise<boolean> {
  if (!context.mapping.redirects || !oldAddress) {
    return false;
  }
  const fromPath = normaliseRedirectPath(oldAddress);
  const toPath = `/products/${created.handle}`;
  if (fromPath === "/" || fromPath === toPath) {
    return false;
  }
  if (await findRedirectFrom(database, DEFAULT_TENANT_ID, fromPath)) {
    return false;
  }
  await insertRedirect(database, {
    fromPath,
    toPath,
    statusCode: 301,
    status: "suggested",
    source: "import",
  });
  return true;
}
