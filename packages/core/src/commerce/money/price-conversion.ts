import type { CurrencyCode } from "./currencies.js";
import { currencyDecimalPlaces, minorUnitsPerMajorUnit } from "./currencies.js";
import { type Money, money } from "./money.js";

/**
 * How a converted price is tidied up, chosen per market:
 *
 *   - `exact`        to the nearest minor unit: €12.34 × 1.17 = $14.44
 *   - `whole`        up to the next whole amount: $14.44 → $15.00
 *   - `ninety_nine`  up to the next amount ending in .99: $14.44 → $14.99
 *
 * Currencies without minor units (yen, won) step in hundreds instead, so "whole" gives
 * ¥1,300 and "ninety_nine" gives ¥1,299 rather than changing nothing.
 */
export const priceRoundingRules = ["exact", "whole", "ninety_nine"] as const;
export type PriceRounding = (typeof priceRoundingRules)[number];

/**
 * Converts a price into another currency at `exchangeRate` (units of `to` per unit of the
 * price's currency), then rounds it by the market's rule. Prices set by hand for a
 * currency are never converted; this is only for the ones left blank.
 */
export function convertPrice(
  price: Money,
  to: CurrencyCode,
  exchangeRate: number,
  rounding: PriceRounding,
): Money {
  if (price.currency === to) {
    return price;
  }
  const majorAmount = (price.amount / minorUnitsPerMajorUnit(price.currency)) * exchangeRate;
  // toFixed first: 14.435 * 100 is 1443.4999… in floating point, which would round down.
  const minorAmount = Math.round(Number((majorAmount * minorUnitsPerMajorUnit(to)).toFixed(6)));
  return money(roundPrice(minorAmount, to, rounding), to);
}

export function roundPrice(
  amount: number,
  currency: CurrencyCode,
  rounding: PriceRounding,
): number {
  if (rounding === "exact" || amount === 0) {
    return amount;
  }
  const step = currencyDecimalPlaces(currency) === 0 ? 100 : minorUnitsPerMajorUnit(currency);
  if (rounding === "whole") {
    return Math.ceil(amount / step) * step;
  }
  // The next amount ending in .99 that isn't below the price: 14.44 → 14.99, 14.99 → 14.99.
  return Math.ceil((amount + 1) / step) * step - 1;
}
