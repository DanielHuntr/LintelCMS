import { activeLanguage } from "./activeLanguage.js";

/**
 * Numbers, dates and times in the admin's current language, through Intl. Call these
 * (or put `{count, number}` or `{when, date, medium}` in a message) rather than
 * toLocaleString() with no locale, which would follow the browser instead of the admin.
 */

export function formattingLocale(): string {
  return activeLanguage().formattingLocale;
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(formattingLocale(), options).format(value);
}

/** "1 Nov 2026, 14:05" in English; each language orders and spells it its own way. */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat(formattingLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatDate(date: string | Date, dateStyle: "medium" | "long" = "medium"): string {
  return new Intl.DateTimeFormat(formattingLocale(), { dateStyle }).format(new Date(date));
}
