import { amountInMarket } from "../markets/market-prices.js";
import type { MarketRow } from "../markets/markets.table.js";
import type { Money } from "../money/money.js";
import type { ShippingRateRow, ShippingZoneRow } from "./shipping.table.js";

/** A way to ship this parcel, with its price in the cart's currency. */
export interface ShippingQuote {
  rateId: string;
  name: string;
  deliveryEstimate: string;
  amount: Money;
}

export interface Parcel {
  country: string;
  weightGrams: number;
  /** The order's subtotal after discounts, for "free over" rates. */
  subtotal: Money;
}

/**
 * The rates offered for a parcel: those of the first zone listing its country. A rate is
 * left out when it has no price for the currency (and none to convert from), or when the
 * parcel is heavier than its last weight step.
 */
export function quoteShipping(
  zones: readonly ShippingZoneRow[],
  rates: readonly ShippingRateRow[],
  parcel: Parcel,
  market: MarketRow,
  primaryCurrency: string,
): ShippingQuote[] {
  const zone = zones.find((candidate) => candidate.countries.includes(parcel.country));
  if (!zone) {
    return [];
  }
  return rates
    .filter((rate) => rate.zoneId === zone.id)
    .flatMap((rate) => {
      const amount = priceRate(rate, parcel, market, primaryCurrency);
      return amount
        ? [{ rateId: rate.id, name: rate.name, deliveryEstimate: rate.deliveryEstimate, amount }]
        : [];
    });
}

function priceRate(
  rate: ShippingRateRow,
  parcel: Parcel,
  market: MarketRow,
  primaryCurrency: string,
): Money | null {
  const amounts =
    rate.kind === "flat"
      ? rate.amounts
      : rate.weightBrackets.find(
          (bracket) => bracket.upToGrams === null || parcel.weightGrams <= bracket.upToGrams,
        )?.amounts;
  if (!amounts) {
    return null;
  }
  const price = amountInMarket(amounts, market, primaryCurrency);
  if (!price) {
    return null;
  }
  const freeOver = rate.freeOverAmounts
    ? amountInMarket(rate.freeOverAmounts, market, primaryCurrency)
    : null;
  if (freeOver && parcel.subtotal.amount >= freeOver.amount) {
    return { amount: 0, currency: price.currency };
  }
  return price;
}
