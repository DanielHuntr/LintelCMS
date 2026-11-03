/**
 * Places on a map, as latitude and longitude in degrees. Plain functions with no imports,
 * shared by the server half (checks, delivery, Liquid) and the admin half (the editor).
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CoordinatesFromLink extends Coordinates {
  /** How far in the link was zoomed, when it says. */
  zoom?: number;
}

export const DEFAULT_ZOOM = 15;

export function isLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/** Five decimal places is about a metre: as close as anyone needs a pin. */
export function roundCoordinate(value: number): number {
  return Number(value.toFixed(5));
}

/** "51.5072° N, 0.1276° W", the way people read coordinates. */
export function formatCoordinates({ latitude, longitude }: Coordinates): string {
  const north = `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? "S" : "N"}`;
  const east = `${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? "W" : "E"}`;
  return `${north}, ${east}`;
}

/** The place on openstreetmap.org, opened in a new page rather than embedded. */
export function openStreetMapUrl({ latitude, longitude }: Coordinates, zoom = DEFAULT_ZOOM) {
  const lat = roundCoordinate(latitude);
  const lon = roundCoordinate(longitude);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`;
}

/** The address of OpenStreetMap's embeddable map, a few streets around the pin at zoom 15. */
export function openStreetMapEmbedUrl({ latitude, longitude }: Coordinates, zoom = DEFAULT_ZOOM) {
  const width = (360 / 2 ** zoom) * 2;
  const height = width * 0.6;
  const box = [
    roundCoordinate(longitude - width / 2),
    roundCoordinate(latitude - height / 2),
    roundCoordinate(longitude + width / 2),
    roundCoordinate(latitude + height / 2),
  ].join(",");
  const marker = `${roundCoordinate(latitude)},${roundCoordinate(longitude)}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}

const NUMBER = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

/**
 * Patterns in links from OpenStreetMap, Google Maps and Apple Maps that hold a place, most
 * exact first: a pin before the middle of the view.
 */
const LINK_PATTERNS: ReadonlyArray<{ pattern: RegExp; zoomGroup?: number; swap?: boolean }> = [
  // OpenStreetMap's pin: ?mlat=51.5&mlon=-0.12
  { pattern: new RegExp(String.raw`[?&]mlat=${NUMBER}&mlon=${NUMBER}`) },
  // Google's pin inside the data part: !3d51.5!4d-0.12
  { pattern: new RegExp(String.raw`!3d${NUMBER}!4d${NUMBER}`) },
  // Google's view: /@51.5,-0.12,15z
  { pattern: new RegExp(String.raw`@${NUMBER},${NUMBER}(?:,(\d{1,2}(?:\.\d+)?)z)?`), zoomGroup: 3 },
  // Apple's pin and Google's search: ?coordinate=, ?ll=, ?q=, ?query=, ?daddr=
  {
    pattern: new RegExp(
      String.raw`[?&](?:coordinate|ll|q|query|daddr|sll)=${NUMBER}(?:,|%2C)\s*${NUMBER}`,
      "i",
    ),
  },
  // OpenStreetMap's view: #map=15/51.5/-0.12
  { pattern: new RegExp(String.raw`#map=(\d{1,2})/${NUMBER}/${NUMBER}`), zoomGroup: 1 },
];

/**
 * Reads a place out of a map link someone pasted (OpenStreetMap, Google Maps, Apple Maps),
 * or out of plain "51.5072, -0.1276". Null when there is none, or it isn't on the Earth.
 */
export function readCoordinatesFromLink(text: string): CoordinatesFromLink | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;

  const plain = new RegExp(String.raw`^${NUMBER}\s*[,\s]\s*${NUMBER}$`).exec(trimmed);
  if (plain) return toCoordinates(plain[1], plain[2]);

  for (const { pattern, zoomGroup } of LINK_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (!match) continue;
    if (zoomGroup === 1) {
      return toCoordinates(match[2], match[3], match[1]);
    }
    return toCoordinates(match[1], match[2], zoomGroup ? match[zoomGroup] : undefined);
  }
  return null;
}

function toCoordinates(
  latitudeText: string | undefined,
  longitudeText: string | undefined,
  zoomText?: string,
): CoordinatesFromLink | null {
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (!isLatitude(latitude) || !isLongitude(longitude)) return null;
  const found: CoordinatesFromLink = {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  };
  const zoom = Math.round(Number(zoomText));
  if (zoomText !== undefined && zoom >= 1 && zoom <= 19) found.zoom = zoom;
  return found;
}
