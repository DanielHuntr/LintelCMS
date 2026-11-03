import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { ShopContext } from "../commerce/commerce.context.js";
import {
  countDiscountUsage,
  listDiscountRows,
} from "../commerce/discounts/discounts.repository.js";
import { describeStock } from "../commerce/inventory/inventory.service.js";
import { amountInMarket, priceInMarket } from "../commerce/markets/market-prices.js";
import { listMarketRows } from "../commerce/markets/markets.repository.js";
import type { MarketRow } from "../commerce/markets/markets.table.js";
import type { CurrencyCode } from "../commerce/money/currencies.js";
import {
  listPriceRows,
  listProductRows,
  listVariantRows,
} from "../commerce/products/products.repository.js";
import { readShopSettingsRow } from "../commerce/settings/shop-settings.service.js";
import { listShippingZones } from "../commerce/shipping/shipping.service.js";

/**
 * The shop as the PHP companion sees it: what each variant costs in each market, how much
 * is in stock, shipping, tax rates and discount codes. Lintel signs it, and the companion
 * works out every basket from it alone, so a shopper can't change a price in the browser.
 *
 * Amounts are already in each market's currency, so the companion never converts.
 */

export interface ShopCatalogue {
  version: 1;
  generatedAt: string;
  markets: Array<{
    id: string;
    name: string;
    currency: string;
    countries: string[];
    isPrimary: boolean;
    taxesIncluded: boolean;
    paymentProvider: "stripe" | "mollie";
  }>;
  variants: Record<
    string,
    {
      productId: string;
      productTitle: string;
      variantTitle: string;
      sku: string | null;
      imageId: string | null;
      weightGrams: number;
      /** Minor units, by market id. A market without a price can't sell it. */
      prices: Record<string, number>;
      /** Null when stock isn't tracked (made to order, digital). */
      stock: number | null;
    }
  >;
  shipping: Array<{
    countries: string[];
    rates: Array<{
      id: string;
      name: string;
      deliveryEstimate: string;
      kind: "flat" | "weight";
      byMarket: Record<
        string,
        {
          amount: number | null;
          brackets: Array<{ upToGrams: number | null; amount: number }>;
          freeOver: number | null;
        }
      >;
    }>;
  }>;
  taxes: { rates: Record<string, number>; taxShipping: boolean };
  discounts: Array<{
    id: string;
    code: string;
    title: string;
    kind: string;
    percentOff: number;
    amounts: Record<string, number>;
    minimumSpend: Record<string, number>;
    scope: string;
    productIds: string[];
    startsAt: string;
    endsAt: string | null;
    usageLimit: number | null;
    usedCount: number;
  }>;
}

export async function buildShopCatalogue(shop: ShopContext): Promise<ShopCatalogue> {
  const database = shop.database;
  const now = shop.now();
  const settings = await readShopSettingsRow(database);
  const markets = await listMarketRows(database, DEFAULT_TENANT_ID);
  const primary = markets.find((market) => market.isPrimary) ?? markets[0];
  const primaryCurrency = (primary?.currency ?? "GBP") as CurrencyCode;
  const { rows: products } = await listProductRows(
    database,
    DEFAULT_TENANT_ID,
    { status: "active" },
    { page: 1, perPage: 10_000 },
  );
  const variants = await listVariantRows(
    database,
    products.map((product) => product.id),
  );
  const prices = await listPriceRows(
    database,
    variants.map((variant) => variant.id),
  );
  const stock = await describeStock(
    database,
    variants.map((variant) => variant.id),
    now,
  );

  const catalogueVariants: ShopCatalogue["variants"] = {};
  for (const variant of variants) {
    const product = products.find((candidate) => candidate.id === variant.productId);
    if (!product) continue;
    const stored = prices.filter((price) => price.variantId === variant.id);
    const byMarket: Record<string, number> = {};
    for (const market of markets) {
      const price = priceInMarket(stored, market, primaryCurrency);
      if (price) byMarket[market.id] = price.price.amount;
    }
    catalogueVariants[variant.id] = {
      productId: product.id,
      productTitle: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      imageId: null,
      weightGrams: variant.weightGrams,
      prices: byMarket,
      stock: variant.inventoryTracked ? (stock.get(variant.id)?.available ?? 0) : null,
    };
  }

  const discounts = (await listDiscountRows(database)).filter(
    (discount) => discount.enabled && discount.method === "code" && discount.code,
  );
  const usage = await countDiscountUsage(
    database,
    discounts.map(({ id }) => id),
    null,
    now,
  );

  return {
    version: 1,
    generatedAt: now.toISOString(),
    markets: markets.map((market) => ({
      id: market.id,
      name: market.name,
      currency: market.currency,
      countries: market.countries,
      isPrimary: market.isPrimary,
      taxesIncluded: market.pricesIncludeTax,
      paymentProvider: market.paymentProvider === "mollie" ? "mollie" : "stripe",
    })),
    variants: catalogueVariants,
    shipping: (await listShippingZones(database)).zones.map((zone) => ({
      countries: zone.countries,
      rates: zone.rates.map((rate) => ({
        id: rate.id,
        name: rate.name,
        deliveryEstimate: rate.deliveryEstimate,
        kind: rate.kind,
        byMarket: Object.fromEntries(
          markets.map((market) => [market.id, rateInMarket(rate, market, primaryCurrency)]),
        ),
      })),
    })),
    taxes: {
      rates: Object.fromEntries(
        settings.manualTaxRates.map((rate) => [rate.country, rate.rate] as const),
      ),
      taxShipping: settings.taxShipping,
    },
    discounts: discounts.map((discount) => ({
      id: discount.id,
      code: discount.code ?? "",
      title: discount.title,
      kind: discount.kind,
      percentOff: discount.percentOff,
      amounts: discount.amounts,
      minimumSpend: discount.minimumSpend,
      scope: discount.scope,
      productIds: discount.productIds,
      startsAt: discount.startsAt.toISOString(),
      endsAt: discount.endsAt?.toISOString() ?? null,
      usageLimit: discount.usageLimit,
      usedCount: usage.get(discount.id)?.total ?? 0,
    })),
  };
}

function rateInMarket(
  rate: {
    kind: "flat" | "weight";
    amounts: Record<string, number>;
    weightBrackets: Array<{ upToGrams: number | null; amounts: Record<string, number> }>;
    freeOverAmounts: Record<string, number> | null;
  },
  market: MarketRow,
  primaryCurrency: CurrencyCode,
) {
  const inMarket = (amounts: Record<string, number>) =>
    amountInMarket(amounts, market, primaryCurrency)?.amount ?? null;
  return {
    amount: rate.kind === "flat" ? inMarket(rate.amounts) : null,
    brackets: rate.weightBrackets.flatMap((bracket) => {
      const amount = inMarket(bracket.amounts);
      return amount === null ? [] : [{ upToGrams: bracket.upToGrams, amount }];
    }),
    freeOver: rate.freeOverAmounts ? inMarket(rate.freeOverAmounts) : null,
  };
}
