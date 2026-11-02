import { isKnownCountryCode } from "@lintel/builder-model";
import { z } from "zod";

/**
 * Currencies are ISO 4217 codes ("EUR", "JPY"). How many decimal places each one has comes
 * from Intl, so yen (0), euros (2) and Kuwaiti dinars (3) all work without a table of our own.
 */
const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

export function isCurrencyCode(code: string): boolean {
  return supportedCurrencies.has(code);
}

export const currencyCodeSchema = z
  .string({ error: "The currency should be a three-letter code, like EUR or USD" })
  .trim()
  .toUpperCase()
  .refine(isCurrencyCode, {
    error: (issue) =>
      `"${String(issue.input)}" isn't a currency Lintel knows. Use a three-letter code, like EUR or USD.`,
  });

export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

const minorUnitCache = new Map<string, number>();

/** Decimal places of the currency: 2 for EUR, 0 for JPY, 3 for KWD. */
export function currencyDecimalPlaces(currency: string): number {
  const cached = minorUnitCache.get(currency);
  if (cached !== undefined) {
    return cached;
  }
  const places =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  minorUnitCache.set(currency, places);
  return places;
}

/** How many minor units make one major unit: 100 cents in a euro, 1 yen in a yen. */
export function minorUnitsPerMajorUnit(currency: string): number {
  return 10 ** currencyDecimalPlaces(currency);
}

/** Two-letter ISO 3166 country codes, as Intl knows them ("GB", "DE", "US"). */
const regionNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });

export function isCountryCode(code: string): boolean {
  return isKnownCountryCode(code);
}

export const countryCodeSchema = z
  .string({ error: "The country should be a two-letter code, like GB or US" })
  .trim()
  .toUpperCase()
  .refine(isCountryCode, {
    error: (issue) =>
      `"${String(issue.input)}" isn't a country code Lintel knows. Use two letters, like GB or US.`,
  });

export function countryName(code: string): string {
  return regionNames.of(code) ?? code;
}
