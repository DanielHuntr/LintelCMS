/**
 * Dates are stored as `YYYY-MM-DD`, or as a full ISO datetime when the field includes a time.
 * Browsers' date inputs speak local time without a zone, so these convert between the two.
 */

/** A stored value as the text a `date` or `datetime-local` input expects. */
export function dateInputValue(value: unknown, includeTime: boolean): string {
  if (typeof value !== "string" || value === "") return "";
  if (!includeTime) return value.slice(0, 10);

  // A date without a time is read as local midnight, not UTC midnight.
  const date = new Date(value.length === 10 ? `${value}T00:00` : value);
  return Number.isNaN(date.getTime()) ? "" : localDateTimeText(date);
}

/** A date input's text as a stored value. Blank means empty. */
export function dateFromInput(text: string, includeTime: boolean): string | null {
  if (text === "") return null;
  if (!includeTime) return text;

  // `new Date("2026-10-31T09:30")` reads the time as local, which is what the person meant.
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "2026-10-31T09:30" in the browser's time zone. */
export function localDateTimeText(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
