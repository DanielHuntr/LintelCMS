import { minorUnitsPerMajorUnit } from "./currencies.js";
import type { Money } from "./money.js";

/**
 * "€19.99", "¥1,999", "19,99 €": how people in a locale write an amount. Used in order
 * emails; the admin and storefronts format on their own side with the same Intl API.
 */
export function formatMoney(value: Money, locale = "en"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: value.currency }).format(
    value.amount / minorUnitsPerMajorUnit(value.currency),
  );
}
