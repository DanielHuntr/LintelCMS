/**
 * Money in the admin, as the API sends it: whole minor units with the currency beside them
 * (`{ amount: 4500, currency: "GBP" }` is £45.00). Formatting and reading typed amounts both
 * use Intl, so yen, euros and dinars each get their own decimal places.
 */
export interface Money {
  amount: number;
  currency: string;
}

const LOCALE = "en";

export function decimalPlaces(currency: string): number {
  try {
    return (
      new Intl.NumberFormat(LOCALE, { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** "£45.00", "¥4,500". */
export function formatMoney(value: Money): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: value.currency }).format(
      value.amount / 10 ** decimalPlaces(value.currency),
    );
  } catch {
    return `${value.amount} ${value.currency}`;
  }
}

/** The amount as typed into a price field: 4500 GBP is "45.00", 4500 JPY is "4500". */
export function minorToInput(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return "";
  return (amount / 10 ** decimalPlaces(currency)).toFixed(decimalPlaces(currency));
}

/**
 * Reads a typed price ("45", "45.5", "£45.50", "1,299.99") into minor units. null when it
 * isn't a price, or has more decimal places than the currency allows.
 */
export function inputToMinor(text: string, currency: string): number | null {
  const cleaned = text.replace(/[^\d.]/g, "");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const places = decimalPlaces(currency);
  const [whole = "0", fraction = ""] = cleaned.split(".");
  if (fraction.length > places) return null;
  return Number(whole) * 10 ** places + Number(fraction.padEnd(places, "0") || "0");
}

/** The currency's symbol on its own, for beside a price field: "£", "€", "¥". */
export function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat(LOCALE, { style: "currency", currency })
      .formatToParts(0)
      .find((piece) => piece.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

const regionNames = new Intl.DisplayNames([LOCALE], { type: "region" });

/** "GB" → "United Kingdom". */
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
