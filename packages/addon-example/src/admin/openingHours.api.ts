import { apiRequest } from "@lintel/admin/plugin";

/** The opening hours, from the add-on's settings (see src/server/opening-hours.ts). */
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

export type OpeningHours = Record<Day, string> & { note: string };

export const openingHoursKey = ["example", "opening-hours"] as const;

export function readOpeningHours(): Promise<OpeningHours> {
  return apiRequest<OpeningHours>("/plugins/example/settings");
}

/** The day of the week today is, here. */
export function today(): Day {
  return DAYS[(new Date().getDay() + 6) % 7] as Day;
}
