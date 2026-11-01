import type { CurrencyCode } from "../money/currencies.js";
import { type Money, money } from "../money/money.js";
import { convertPrice } from "../money/price-conversion.js";
import type { MarketRow } from "./markets.table.js";

/** A variant's prices as stored: one per currency it has been given a price in. */
export interface StoredPrice {
  currency: string;
  amount: number;
  compareAtAmount: number | null;
}

export interface MarketPrice {
  price: Money;
  compareAtPrice: Money | null;
}

/**
 * What a variant costs in a market: its own price in the market's currency if it has one,
 * otherwise its primary-currency price converted at the market's rate and rounded by the
 * market's rule. null when there is neither, so it can't be bought there.
 */
export function priceInMarket(
  prices: readonly StoredPrice[],
  market: MarketRow,
  primaryCurrency: string,
): MarketPrice | null {
  const own = prices.find((price) => price.currency === market.currency);
  if (own) {
    return {
      price: money(own.amount, market.currency),
      compareAtPrice:
        own.compareAtAmount === null ? null : money(own.compareAtAmount, market.currency),
    };
  }
  const base = prices.find((price) => price.currency === primaryCurrency);
  if (!base) {
    return null;
  }
  const convert = (amount: number) =>
    convertPrice(
      money(amount, primaryCurrency),
      market.currency,
      market.exchangeRate,
      market.priceRounding,
    );
  return {
    price: convert(base.amount),
    compareAtPrice: base.compareAtAmount === null ? null : convert(base.compareAtAmount),
  };
}

/** The same rule for anything priced by currency, such as shipping rates. */
export function amountInMarket(
  amounts: Readonly<Record<string, number>>,
  market: MarketRow,
  primaryCurrency: CurrencyCode,
): Money | null {
  const own = amounts[market.currency];
  if (own !== undefined) {
    return money(own, market.currency);
  }
  const base = amounts[primaryCurrency];
  if (base === undefined) {
    return null;
  }
  return convertPrice(
    money(base, primaryCurrency),
    market.currency,
    market.exchangeRate,
    market.priceRounding,
  );
}
