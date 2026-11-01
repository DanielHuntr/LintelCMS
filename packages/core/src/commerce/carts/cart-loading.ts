import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { ShopContext } from "../commerce.context.js";
import type { Discount } from "../discounts/discount-provider.js";
import { listOpenCheckoutIdsForCart } from "../checkouts/checkouts.repository.js";
import { describeStock } from "../inventory/inventory.service.js";
import { findMarket, findPrimaryMarket } from "../markets/markets.service.js";
import type { MarketRow } from "../markets/markets.table.js";
import type { Money } from "../money/money.js";
import {
  listPriceRows,
  listProductRowsById,
  listVariantRowsById,
} from "../products/products.repository.js";
import { findShippingQuotes } from "../shipping/shipping.service.js";
import type { ShippingQuote } from "../shipping/shipping-quotes.js";
import { applyDiscounts, type PricedCartLine, priceCartLines } from "./cart-pricing.js";
import { hashCartToken } from "./cart-tokens.js";
import { CartNotFoundError } from "./carts.errors.js";
import { findCartRowByTokenHash, listCartLineRows } from "./carts.repository.js";
import type { CartRow } from "./carts.table.js";

/**
 * A cart with everything worked out: prices in its market, discounts, the shipping options
 * for its address and the chosen one. The cart endpoints and the checkout both start here.
 */
export interface PricedCart {
  row: CartRow;
  market: MarketRow;
  primaryCurrency: string;
  lines: PricedCartLine[];
  /** Lines that can be bought, after discounts. */
  subtotal: Money;
  discountTotal: number;
  discounts: Discount[];
  shippingQuotes: ShippingQuote[];
  chosenShipping: ShippingQuote | null;
  weightGrams: number;
}

export async function findCartByToken(
  database: DatabaseOrTransaction,
  token: string,
): Promise<CartRow> {
  const row = await findCartRowByTokenHash(database, hashCartToken(token));
  if (!row) {
    throw new CartNotFoundError();
  }
  return row;
}

export async function loadPricedCart(
  shop: ShopContext,
  database: DatabaseOrTransaction,
  row: CartRow,
): Promise<PricedCart> {
  const market = await findMarket(database, row.marketId);
  const primaryCurrency = (await findPrimaryMarket(database)).currency;
  const lineRows = await listCartLineRows(database, row.id);
  const variantRows = await listVariantRowsById(
    database,
    DEFAULT_TENANT_ID,
    lineRows.map((line) => line.variantId),
  );
  const productRows = await listProductRowsById(
    database,
    DEFAULT_TENANT_ID,
    variantRows.map((variant) => variant.productId),
  );
  const variantIds = variantRows.map((variant) => variant.id);
  const priced = priceCartLines(
    lineRows,
    {
      variants: new Map(variantRows.map((variant) => [variant.id, variant])),
      products: new Map(productRows.map((product) => [product.id, product])),
      prices: await listPriceRows(database, variantIds),
      stock: await describeStock(
        database,
        variantIds,
        shop.now(),
        await listOpenCheckoutIdsForCart(database, row.id),
      ),
    },
    market,
    primaryCurrency,
  );

  const buyable = priced.filter((line) => line.problem === null);
  const grossSubtotal = buyable.reduce((sum, line) => sum + line.subtotal.amount, 0);
  const offered = await shop.discounts.findDiscounts({
    currency: market.currency,
    marketId: market.id,
    codes: row.discountCodes,
    email: row.email,
    lines: buyable.map((line) => ({
      variantId: line.variantId,
      productId: line.productId ?? "",
      quantity: line.quantity,
      subtotalAmount: line.subtotal.amount,
    })),
    subtotalAmount: grossSubtotal,
  });
  const { lines, discountTotal, applied } = applyDiscounts(priced, offered);
  const subtotal = { amount: grossSubtotal - discountTotal, currency: market.currency };
  const weightGrams = buyable.reduce((sum, line) => sum + line.weightGrams * line.quantity, 0);
  const country = row.shippingAddress?.country ?? row.country;
  const shippingQuotes = country
    ? await findShippingQuotes(
        database,
        { country, weightGrams, subtotal },
        market,
        primaryCurrency,
      )
    : [];

  return {
    row,
    market,
    primaryCurrency,
    lines,
    subtotal: { amount: grossSubtotal, currency: market.currency },
    discountTotal,
    discounts: applied,
    shippingQuotes,
    chosenShipping: shippingQuotes.find((quote) => quote.rateId === row.shippingRateId) ?? null,
    weightGrams,
  };
}
