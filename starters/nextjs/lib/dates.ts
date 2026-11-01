/** "30 October 2026". Uses UTC, so the date doesn't change with the server's time zone. */
export function formatDate(isoDate: string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}
