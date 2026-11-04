import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import { oneOf, plainText } from "./component-props.js";

/**
 * A small live clock showing the time in one place, as studio sites show "London 14:05" in
 * a corner. It updates each minute on the website; without scripts it shows the place only.
 */

/** Places people pick from, by their city's name, with the time zone each one uses. */
export const clockPlaces = [
  { zone: "local", city: "The visitor’s own time" },
  { zone: "Europe/London", city: "London" },
  { zone: "Europe/Dublin", city: "Dublin" },
  { zone: "Europe/Lisbon", city: "Lisbon" },
  { zone: "Europe/Paris", city: "Paris" },
  { zone: "Europe/Amsterdam", city: "Amsterdam" },
  { zone: "Europe/Berlin", city: "Berlin" },
  { zone: "Europe/Madrid", city: "Madrid" },
  { zone: "Europe/Rome", city: "Rome" },
  { zone: "Europe/Stockholm", city: "Stockholm" },
  { zone: "Europe/Athens", city: "Athens" },
  { zone: "Europe/Istanbul", city: "Istanbul" },
  { zone: "Africa/Lagos", city: "Lagos" },
  { zone: "Africa/Johannesburg", city: "Johannesburg" },
  { zone: "Asia/Dubai", city: "Dubai" },
  { zone: "Asia/Kolkata", city: "Mumbai" },
  { zone: "Asia/Singapore", city: "Singapore" },
  { zone: "Asia/Hong_Kong", city: "Hong Kong" },
  { zone: "Asia/Shanghai", city: "Shanghai" },
  { zone: "Asia/Seoul", city: "Seoul" },
  { zone: "Asia/Tokyo", city: "Tokyo" },
  { zone: "Australia/Perth", city: "Perth" },
  { zone: "Australia/Melbourne", city: "Melbourne" },
  { zone: "Australia/Sydney", city: "Sydney" },
  { zone: "Pacific/Auckland", city: "Auckland" },
  { zone: "America/Sao_Paulo", city: "São Paulo" },
  { zone: "America/Mexico_City", city: "Mexico City" },
  { zone: "America/New_York", city: "New York" },
  { zone: "America/Toronto", city: "Toronto" },
  { zone: "America/Chicago", city: "Chicago" },
  { zone: "America/Denver", city: "Denver" },
  { zone: "America/Los_Angeles", city: "Los Angeles" },
  { zone: "America/Vancouver", city: "Vancouver" },
] as const;

/**
 * "local" or any name shaped like a time zone. The list above is what the builder offers, not
 * all that's allowed: a design with a zone that isn't on it, such as a template's footer, has
 * to keep working rather than be turned down.
 */
const clockZonePattern = /^(local|[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+)$/;

/** The city's name for a time zone, or empty for the visitor's own time. */
export function clockPlaceName(zone: string): string {
  if (zone === "local") return "";
  const listed = clockPlaces.find((place) => place.zone === zone)?.city;
  return listed ?? zone.split("/").at(-1)?.replaceAll("_", " ") ?? "";
}

/**
 * The time in a place as people read it there: "14:05" or "2:05 pm". "local" (or a zone the
 * browser doesn't know) uses the reader's own time.
 */
export function formatClockTime(
  date: Date,
  zone: string,
  hours: "24" | "12",
  locale?: string,
): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: hours === "24" ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: hours === "12",
  };
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      ...options,
      timeZone: zone === "local" ? undefined : zone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
}

export const clockComponent = defineComponent({
  type: "clock",
  label: "Clock",
  keywords: ["time", "time zone", "local time", "live clock", "world clock"],
  description:
    "The time now in a place you choose, such as “London 14:05”. It keeps itself up to date.",
  icon: "clock",
  category: "text",
  propsSchema: z.object({
    zone: z
      .string()
      .regex(clockZonePattern, { error: "Choose a place from the list" })
      .default("Europe/London"),
    hours: oneOf(["24", "12"], "The clock"),
    label: plainText(60, ""),
  }),
  defaultProps: { zone: "Europe/London", hours: "24", label: "" },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "choice",
      prop: "zone",
      label: "Place",
      choices: clockPlaces.map((place) => ({ value: place.zone, label: place.city })),
    },
    {
      kind: "choice",
      prop: "hours",
      label: "Clock",
      choices: [
        { value: "24", label: "24-hour (14:05)" },
        { value: "12", label: "12-hour (2:05 pm)" },
      ],
    },
    {
      kind: "text",
      prop: "label",
      label: "Name shown beside it",
      placeholder: "The place’s name",
      advanced: true,
    },
  ],
});
