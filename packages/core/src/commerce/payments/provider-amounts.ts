import { currencyDecimalPlaces } from "../money/currencies.js";

/**
 * PayPal and Mollie take amounts as decimal strings ("45.00", "1999" for yen). These turn
 * Lintel's whole minor units into those and back with string arithmetic only, so no amount
 * ever passes through a floating-point number.
 */
export function toDecimalAmount(amount: number, currency: string): string {
  const places = currencyDecimalPlaces(currency);
  const negative = amount < 0;
  const digits = String(Math.abs(amount)).padStart(places + 1, "0");
  const whole = digits.slice(0, digits.length - places);
  const fraction = places > 0 ? `.${digits.slice(digits.length - places)}` : "";
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/** "45.00" in GBP is 4500. Null when the text isn't an amount in that currency. */
export function fromDecimalAmount(value: string, currency: string): number | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const places = currencyDecimalPlaces(currency);
  const fraction = match[2] ?? "";
  if (fraction.length > places && /[1-9]/.test(fraction.slice(places))) return null;
  const amount = Number(`${match[1]}${fraction.slice(0, places).padEnd(places, "0")}`);
  return Number.isSafeInteger(amount) ? amount : null;
}
