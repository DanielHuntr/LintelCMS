/**
 * Date arithmetic for the schedule calendar, in the browser's own time zone: a "day" is the
 * day as the person sees it on their wall calendar, so a page due at 00:30 on Tuesday shows
 * on Tuesday wherever the server is.
 */

export interface Month {
  year: number;
  /** 1 to 12. */
  month: number;
}

export interface CalendarDay {
  date: Date;
  /** "2026-11-04", for keys and for matching entries to days. */
  key: string;
  isInMonth: boolean;
}

/** Weeks start on Monday, as calendars do in most of the places Lintel is used. */
const MONDAY = 1;

export function monthOf(date: Date): Month {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** "2026-11" as a Month, or undefined for anything else. */
export function parseMonth(text: unknown): Month | undefined {
  const match = typeof text === "string" ? /^(\d{4})-(\d{2})$/.exec(text) : null;
  if (!match) return undefined;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : undefined;
}

export function formatMonthParam({ year, month }: Month): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function addMonths({ year, month }: Month, count: number): Month {
  const index = year * 12 + (month - 1) + count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function dayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Every day the month view shows: whole weeks, from the Monday on or before the 1st. */
export function monthGrid({ year, month }: Month): CalendarDay[][] {
  const first = new Date(year, month - 1, 1);
  const leadingDays = (first.getDay() - MONDAY + 7) % 7;
  const start = new Date(year, month - 1, 1 - leadingDays);
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekCount = Math.ceil((leadingDays + daysInMonth) / 7);
  return Array.from({ length: weekCount }, (_week, weekIndex) =>
    Array.from({ length: 7 }, (_day, dayIndex) => {
      const date = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + weekIndex * 7 + dayIndex,
      );
      return { date, key: dayKey(date), isInMonth: date.getMonth() === month - 1 };
    }),
  );
}

/** From the start of the grid's first day to the start of the day after its last. */
export function gridRange(weeks: CalendarDay[][]): { from: Date; to: Date } {
  const firstDay = weeks[0]?.[0]?.date ?? new Date();
  const lastDay = weeks.at(-1)?.at(-1)?.date ?? firstDay;
  return {
    from: new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate()),
    to: new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1),
  };
}
