/** Small date helpers. Times are shown in the browser's own time zone. */

export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysLater(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function formatTime(isoDate: string): string {
  return new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(new Date(isoDate));
}

export function formatDay(isoDate: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(new Date(isoDate));
}

/** What an `<input type="datetime-local">` shows for a moment: "2026-11-02T10:00". */
export function toLocalInputValue(isoDate: string): string {
  const date = new Date(isoDate);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Bookings grouped by the day they start, in order. */
export function groupByDay<Item extends { startsAt: string }>(items: readonly Item[]) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const day = formatDay(item.startsAt);
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return [...groups.entries()].map(([day, dayItems]) => ({ day, items: dayItems }));
}
