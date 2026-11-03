import { defineFieldtype, escapeHtml } from "@lintel/core/plugin";
import { z } from "zod";
import {
  type Coordinates,
  DEFAULT_ZOOM,
  formatCoordinates,
  isLatitude,
  isLongitude,
  openStreetMapUrl,
  roundCoordinate,
} from "../shared/coordinates.js";

/**
 * The Map location field: a place as latitude and longitude, with an optional name and
 * address. Stored as `{ latitude, longitude, label, address }`; delivered with the
 * coordinates written out and a link to the place on OpenStreetMap. Nothing is loaded from
 * another company to store or deliver it.
 */

export const locationOptionsSchema = z.object({
  /** How close maps of this place start: 1 (the world) to 19 (a building). */
  zoom: z
    .number({ error: "The zoom should be a number" })
    .int({ error: "The zoom should be a whole number" })
    .min(1, { error: "The zoom should be between 1 and 19" })
    .max(19, { error: "The zoom should be between 1 and 19" })
    .default(DEFAULT_ZOOM),
});
export type LocationOptions = z.output<typeof locationOptionsSchema>;

export interface StoredLocation extends Coordinates {
  label: string;
  address: string;
}

export interface DeliveredLocation extends StoredLocation {
  /** "51.5072° N, 0.1276° W" */
  coordinates: string;
  zoom: number;
  openStreetMapUrl: string;
}

export const locationFieldtype = defineFieldtype({
  type: "extra-fields.location",
  name: "Map location",
  description: "A place on the map, such as your shop or an event's venue.",
  category: "media",
  keywords: ["map", "place", "address", "latitude", "longitude", "venue", "pin"],
  optionsSchema: locationOptionsSchema,
  buildValueSchema: (_options, label) =>
    z.object(
      {
        latitude: z
          .number({ error: `${label} needs a latitude, such as 51.5072` })
          .refine(isLatitude, { error: `${label}'s latitude should be between -90 and 90` })
          .transform(roundCoordinate),
        longitude: z
          .number({ error: `${label} needs a longitude, such as -0.1276` })
          .refine(isLongitude, { error: `${label}'s longitude should be between -180 and 180` })
          .transform(roundCoordinate),
        label: z
          .string({ error: `${label}'s name should be text` })
          .trim()
          .max(120, { error: `Keep ${label}'s name under 120 characters` })
          .default(""),
        address: z
          .string({ error: `${label}'s address should be text` })
          .trim()
          .max(300, { error: `Keep ${label}'s address under 300 characters` })
          .default(""),
      },
      { error: `${label} should be a place on the map` },
    ),
  deliver: (value, options): DeliveredLocation | null => {
    const location = readLocation(value);
    return location ? describeLocation(location, options.zoom) : null;
  },
});

export function describeLocation(location: StoredLocation, zoom: number): DeliveredLocation {
  return {
    ...location,
    coordinates: formatCoordinates(location),
    zoom,
    openStreetMapUrl: openStreetMapUrl(location, zoom),
  };
}

/** A location as stored or as delivered; null for anything else. */
export function readLocation(value: unknown): (StoredLocation & { zoom?: number }) | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  if (
    record.latitude === null ||
    record.longitude === null ||
    record.latitude === "" ||
    record.longitude === "" ||
    !isLatitude(latitude) ||
    !isLongitude(longitude)
  ) {
    return null;
  }
  const location: StoredLocation & { zoom?: number } = {
    latitude,
    longitude,
    label: typeof record.label === "string" ? record.label : "",
    address: typeof record.address === "string" ? record.address : "",
  };
  if (typeof record.zoom === "number" && record.zoom >= 1 && record.zoom <= 19) {
    location.zoom = Math.round(record.zoom);
  }
  return location;
}

/** `{{ place | extra_fields_map_link }}`: a link to the place on OpenStreetMap. */
export function renderMapLink(value: unknown, linkText?: unknown): string {
  const location = readLocation(value);
  if (!location) return "";
  const words =
    typeof linkText === "string" && linkText.trim() !== ""
      ? linkText
      : location.label || "View on OpenStreetMap";
  const href = openStreetMapUrl(location, location.zoom ?? DEFAULT_ZOOM);
  return `<a class="extra-fields-map-link" href="${escapeHtml(href)}" rel="noopener" target="_blank">${escapeHtml(words)}</a>`;
}

/** `{{ place | extra_fields_coordinates }}`: "51.5072° N, 0.1276° W". */
export function renderCoordinates(value: unknown): string {
  const location = readLocation(value);
  return location ? formatCoordinates(location) : "";
}
