const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** "1 Nov 2026" */
export function formatOrderDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** "1 Nov, 10:42", for the timeline. */
export function formatOrderTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
