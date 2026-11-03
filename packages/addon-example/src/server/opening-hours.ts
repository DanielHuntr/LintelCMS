import { escapeHtml } from "@lintel/core/plugin";
import { z } from "zod";

/**
 * Opening hours, kept in the add-on's settings: a line of text per day ("9:00–17:00",
 * "10:00–14:00 and 15:00–18:00"), blank for closed. Text rather than times, because shops
 * write their hours in all sorts of ways and the form on the Add-ons screen stays simple.
 */

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Day = (typeof DAYS)[number];

const hoursText = z.string().trim().max(60, { error: "Keep each day's hours under 60 characters" });

export const openingHoursSchema = z.object({
  monday: hoursText,
  tuesday: hoursText,
  wednesday: hoursText,
  thursday: hoursText,
  friday: hoursText,
  saturday: hoursText,
  sunday: hoursText,
  /** A line under the table, such as "Closed on bank holidays". */
  note: z.string().trim().max(120, { error: "Keep the note under 120 characters" }),
});
export type OpeningHours = z.output<typeof openingHoursSchema>;

export const defaultOpeningHours: OpeningHours = {
  monday: "9:00–17:00",
  tuesday: "9:00–17:00",
  wednesday: "9:00–17:00",
  thursday: "9:00–17:00",
  friday: "9:00–17:00",
  saturday: "10:00–14:00",
  sunday: "",
  note: "",
};

export function dayName(day: Day): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** The day of the week a date falls on, where it is (in the server's time zone). */
export function dayOf(date: Date): Day {
  // getDay() counts from Sunday.
  return DAYS[(date.getDay() + 6) % 7] as Day;
}

/** The week as a table, today marked, for `{% example_opening_hours %}`. */
export function renderOpeningHoursTable(hours: OpeningHours, today: Day): string {
  const rows = DAYS.map((day) => {
    const current = day === today ? ' aria-current="date" class="example-hours__today"' : "";
    const text = hours[day] || "Closed";
    return `<tr${current}><th scope="row">${dayName(day)}</th><td>${escapeHtml(text)}</td></tr>`;
  }).join("");
  const note = hours.note ? `<p class="example-hours__note">${escapeHtml(hours.note)}</p>` : "";
  return `<div class="example-hours"><table><caption>Opening hours</caption><tbody>${rows}</tbody></table>${note}</div>`;
}

/** "Open today 9:00–17:00" or "Closed today", for `{% example_open_today %}`. */
export function describeToday(hours: OpeningHours, today: Day, label = "Open today"): string {
  const text = hours[today];
  return text ? `${label} ${text}` : "Closed today";
}
