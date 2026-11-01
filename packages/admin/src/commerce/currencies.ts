/**
 * The currencies offered when making a market: the ones most shops use first, then every
 * other currency Intl knows, each labelled "GBP · British Pound".
 */
const popular = [
  "GBP",
  "EUR",
  "USD",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
];

let cached: Array<{ code: string; label: string }> | undefined;

export function commonCurrencies(): Array<{ code: string; label: string }> {
  if (cached) return cached;
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  const all = Intl.supportedValuesOf("currency");
  const ordered = [...popular, ...all.filter((code) => !popular.includes(code))];
  cached = ordered.map((code) => ({ code, label: `${code} · ${names.of(code) ?? code}` }));
  return cached;
}
