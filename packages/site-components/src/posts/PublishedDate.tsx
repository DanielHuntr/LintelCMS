/**
 * A date as people write it in the page's language ("12 March 2026" in en-GB), in a
 * `<time datetime>`. Formatted in UTC, the same as post addresses, so a page reads the
 * same wherever the server runs.
 */
export function PublishedDate({ date, locale }: { date: string; locale: string }) {
  return (
    <time className="lintel-date" dateTime={date}>
      {formatDate(date, locale)}
    </time>
  );
}

export function formatDate(date: string, locale: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(parsed);
  }
}
