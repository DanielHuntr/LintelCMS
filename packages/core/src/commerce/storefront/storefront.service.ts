import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { renderRichTextHtml, type RichTextDocument } from "../../fieldtypes/rich-text.js";
import type { ShopContext } from "../commerce.context.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import { priceInMarket } from "../markets/market-prices.js";
import { listMarketRows } from "../markets/markets.repository.js";
import { findMarketForCountry, findPrimaryMarket } from "../markets/markets.service.js";
import type { MarketRow } from "../markets/markets.table.js";
import {
  findCollectionProducts,
  findProductCollectionByHandle,
  listProductCollections,
} from "../product-collections/product-collections.service.js";
import { findProductRowByHandle, listProductRows } from "../products/products.repository.js";
import { listRateRows, listZoneRows } from "../shipping/shipping.repository.js";
import { loadProductDetails, type ProductDetails } from "../products/products.service.js";
import type { ProductRow } from "../products/products.table.js";
import { isShopOpen } from "./shop-readiness.service.js";
import type {
  StorefrontListQuery,
  StorefrontMarket,
  StorefrontProduct,
} from "./storefront.schema.js";

/**
 * The catalogue as shoppers see it: active products only, priced in the market for the
 * shopper's country, with photos expanded as the delivery API expands them. Exact stock
 * numbers stay private; the storefront learns only whether each variant can be bought.
 */

/** A test session shops before the shop is open, so it gets products that can be bought. */
export interface StorefrontVisit {
  testSession: boolean;
}

const ORDINARY_VISIT: StorefrontVisit = { testSession: false };

export async function listStorefrontProducts(
  shop: ShopContext,
  query: StorefrontListQuery,
  visit: StorefrontVisit = ORDINARY_VISIT,
) {
  const market = await findMarketForCountry(shop.database, query.country);
  if (query.collection) {
    return listCollectionProducts(shop, query.collection, market, query, visit);
  }
  const { rows, total } = await listProductRows(
    shop.database,
    DEFAULT_TENANT_ID,
    { status: "active" },
    query,
  );
  return {
    items: await describeProducts(shop, rows, market, visit),
    total,
    currency: market.currency,
  };
}

export async function findStorefrontProduct(
  shop: ShopContext,
  handle: string,
  country: string | undefined,
  visit: StorefrontVisit = ORDINARY_VISIT,
): Promise<StorefrontProduct> {
  const row = await findProductRowByHandle(shop.database, DEFAULT_TENANT_ID, handle);
  if (!row || row.status !== "active") {
    throw new ShopRecordNotFoundError("product");
  }
  const market = await findMarketForCountry(shop.database, country);
  const [product] = await describeProducts(shop, [row], market, visit);
  if (!product) throw new ShopRecordNotFoundError("product");
  return product;
}

export async function listStorefrontCollections(shop: ShopContext) {
  const { collections } = await listProductCollections(shop.database);
  return {
    items: collections.map(({ id, title, handle, description }) => ({
      id,
      title,
      handle,
      description,
    })),
  };
}

export async function findStorefrontCollection(
  shop: ShopContext,
  handle: string,
  query: StorefrontListQuery,
  visit: StorefrontVisit = ORDINARY_VISIT,
) {
  const collection = await findProductCollectionByHandle(shop.database, handle);
  if (!collection) {
    throw new ShopRecordNotFoundError("collection");
  }
  const market = await findMarketForCountry(shop.database, query.country);
  const products = await listCollectionProducts(shop, handle, market, query, visit);
  return {
    id: collection.id,
    title: collection.title,
    handle: collection.handle,
    description: collection.description,
    products,
  };
}

export async function listStorefrontMarkets(
  shop: ShopContext,
): Promise<{ markets: StorefrontMarket[] }> {
  const rows = await listMarketRows(shop.database, DEFAULT_TENANT_ID);
  const delivered = await listCountriesWithDelivery(shop);
  return {
    markets: rows.map((row) => ({
      handle: row.handle,
      name: row.name,
      currency: row.currency,
      countries: row.countries,
      deliveryCountries: row.countries.filter((country) => delivered.has(country)),
      pricesIncludeTax: row.pricesIncludeTax,
    })),
  };
}

/** Countries in a shipping zone that has at least one rate, so an address there gets one. */
async function listCountriesWithDelivery(shop: ShopContext): Promise<Set<string>> {
  const zones = await listZoneRows(shop.database, DEFAULT_TENANT_ID);
  const rates = await listRateRows(
    shop.database,
    zones.map((zone) => zone.id),
  );
  const zonesWithRates = new Set(rates.map((rate) => rate.zoneId));
  return new Set(
    zones.filter((zone) => zonesWithRates.has(zone.id)).flatMap((zone) => zone.countries),
  );
}

async function listCollectionProducts(
  shop: ShopContext,
  handle: string,
  market: MarketRow,
  page: { page: number; perPage: number },
  visit: StorefrontVisit,
) {
  const collection = await findProductCollectionByHandle(shop.database, handle);
  if (!collection) {
    throw new ShopRecordNotFoundError("collection");
  }
  const { rows, total } = await findCollectionProducts(shop.database, collection, "active", page);
  return {
    items: await describeProducts(shop, rows, market, visit),
    total,
    currency: market.currency,
  };
}

async function describeProducts(
  shop: ShopContext,
  rows: readonly ProductRow[],
  market: MarketRow,
  visit: StorefrontVisit,
): Promise<StorefrontProduct[]> {
  const details = await loadProductDetails(shop.database, rows, shop.now());
  const primaryCurrency = (await findPrimaryMarket(shop.database)).currency;
  const images = await shop.assetLookup.findAssetsByIds(rows.flatMap((row) => row.mediaIds));
  const products = rows.map((row) =>
    describeProduct(row, details, market, primaryCurrency, images),
  );
  // Until the shop can take an order, products show as coming soon, with nothing to buy.
  if (visit.testSession || (await isShopOpen(shop))) return products;
  return products.map((product) => ({
    ...product,
    availableForSale: false,
    comingSoon: true,
    variants: product.variants.map((variant) => ({ ...variant, availableForSale: false })),
  }));
}

function describeProduct(
  row: ProductRow,
  details: ProductDetails,
  market: MarketRow,
  primaryCurrency: string,
  images: Awaited<ReturnType<ShopContext["assetLookup"]["findAssetsByIds"]>>,
): StorefrontProduct {
  const variants = details.variants
    .filter((variant) => variant.productId === row.id)
    .map((variant) => {
      const prices = details.prices.filter((price) => price.variantId === variant.id);
      const marketPrice = priceInMarket(prices, market, primaryCurrency);
      const inStock =
        !variant.inventoryTracked || (details.stock.get(variant.id)?.available ?? 0) > 0;
      return {
        id: variant.id,
        title: variant.title,
        optionValues: variant.optionValues,
        sku: variant.sku,
        price: marketPrice?.price ?? null,
        compareAtPrice: marketPrice?.compareAtPrice ?? null,
        availableForSale: marketPrice !== null && inStock,
        weightGrams: variant.weightGrams,
      };
    });
  const amounts = variants.flatMap((variant) => (variant.price ? [variant.price.amount] : []));
  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    descriptionHtml: row.description ? renderRichTextHtml(row.description as RichTextDocument) : "",
    vendor: row.vendor,
    productType: row.productType,
    tags: row.tags,
    seo: { title: row.seoTitle || row.title, description: row.seoDescription },
    images: row.mediaIds.flatMap((assetId) => {
      const image = images.get(assetId);
      return image ? [image] : [];
    }),
    options: row.options,
    priceRange:
      amounts.length > 0
        ? {
            min: { amount: Math.min(...amounts), currency: market.currency },
            max: { amount: Math.max(...amounts), currency: market.currency },
          }
        : null,
    availableForSale: variants.some((variant) => variant.availableForSale),
    comingSoon: false,
    variants,
  };
}
