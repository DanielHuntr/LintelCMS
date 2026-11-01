import {
  formatDateTime as formatDateTimeInLanguage,
  formattingLocale,
} from "../i18n/formatting.js";

const units: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 365 * 24 * 60 * 60 },
  { unit: "month", seconds: 30 * 24 * 60 * 60 },
  { unit: "week", seconds: 7 * 24 * 60 * 60 },
  { unit: "day", seconds: 24 * 60 * 60 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
];

/**
 * "2 hours ago", "yesterday", "in 3 days" for a date compared with now. Anything under a
 * minute is "now", because seconds ticking by on a list is noise.
 */
export function formatRelativeTime(isoDate: string, now: number): string {
  const formatter = new Intl.RelativeTimeFormat(formattingLocale(), { numeric: "auto" });
  const elapsedSeconds = (new Date(isoDate).getTime() - now) / 1000;
  const match = units.find(({ seconds }) => Math.abs(elapsedSeconds) >= seconds);
  if (!match) return formatter.format(0, "second");
  return formatter.format(Math.round(elapsedSeconds / match.seconds), match.unit);
}

/** The full date and time, for a tooltip or a screen reader next to the relative time. */
export function formatDateTime(isoDate: string): string {
  return formatDateTimeInLanguage(isoDate);
}
