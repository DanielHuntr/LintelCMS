import type {
  AnalyticsEventKind,
  DeviceClass,
  EventProperties,
  RollupDimension,
} from "./analytics-events.js";

/**
 * Turning one day's events for one site into its daily figures. Pure, so the counting rules
 * are tested without a database:
 *
 *   - visitors are distinct visitor hashes that opened a page (or, for goals, links and
 *     events, that did that thing), so one person opening five pages is one visitor;
 *   - views count "view" events; time on page is the total and count of "leave" events;
 *   - conversions and their value count "goal" events.
 *
 * Hashes change every day, so a person visiting on Monday and Tuesday is two visitors in a
 * week: the price of never being able to follow anyone from one day to the next.
 */

export interface EventForRollup {
  kind: AnalyticsEventKind;
  visitorHash: string | null;
  path: string;
  source: string;
  campaign: string;
  device: DeviceClass | null;
  country: string;
  durationMs: number | null;
  name: string;
  value: number;
  /** For views of a page running an A/B test: `{ experiment, variant }`. */
  properties?: EventProperties;
}

export interface DailyFigures {
  dimension: RollupDimension;
  key: string;
  visitors: number;
  views: number;
  durationMs: number;
  durationCount: number;
  conversions: number;
  value: number;
}

interface Tally {
  visitors: Set<string>;
  views: number;
  durationMs: number;
  durationCount: number;
  conversions: number;
  value: number;
}

function emptyTally(): Tally {
  return {
    visitors: new Set(),
    views: 0,
    durationMs: 0,
    durationCount: 0,
    conversions: 0,
    value: 0,
  };
}

/** Which rows an event adds to, and whether it counts as a visit there. */
function placesFor(event: EventForRollup): { dimension: RollupDimension; key: string }[] {
  switch (event.kind) {
    case "view":
      return [
        { dimension: "total", key: "" },
        { dimension: "page", key: event.path },
        { dimension: "source", key: event.source },
        ...(event.campaign ? [{ dimension: "campaign" as const, key: event.campaign }] : []),
        ...(event.device ? [{ dimension: "device" as const, key: event.device }] : []),
        { dimension: "country", key: event.country },
        ...versionPlace(event),
      ];
    case "leave":
      return [
        { dimension: "total", key: "" },
        { dimension: "page", key: event.path },
      ];
    case "goal":
      return [
        { dimension: "total", key: "" },
        { dimension: "goal", key: event.name },
        ...(event.path ? [{ dimension: "page" as const, key: event.path }] : []),
      ];
    case "outbound":
      return [{ dimension: "outbound", key: event.name }];
    case "custom":
      return [{ dimension: "event", key: event.name }];
  }
}

/** The A/B test version a page view was tagged with, if any. */
function versionPlace(event: EventForRollup): { dimension: "version"; key: string }[] {
  const experiment = event.properties?.experiment;
  const variant = event.properties?.variant;
  if (typeof experiment !== "string" || typeof variant !== "string") return [];
  return [{ dimension: "version", key: `${experiment}:${variant}` }];
}

function addTo(tally: Tally, event: EventForRollup, dimension: RollupDimension): void {
  if (event.kind === "view") {
    tally.views += 1;
    if (event.visitorHash) tally.visitors.add(event.visitorHash);
  } else if (event.kind === "leave" && event.durationMs !== null) {
    tally.durationMs += event.durationMs;
    tally.durationCount += 1;
  } else if (event.kind === "goal") {
    tally.conversions += 1;
    tally.value += event.value;
    // On the goal's own row, visitors are the people who reached it.
    if (dimension === "goal" && event.visitorHash) tally.visitors.add(event.visitorHash);
  } else if (event.kind === "outbound" || event.kind === "custom") {
    tally.views += 1;
    if (event.visitorHash) tally.visitors.add(event.visitorHash);
  }
}

export function rollUpEvents(events: readonly EventForRollup[]): DailyFigures[] {
  const tallies = new Map<string, { dimension: RollupDimension; key: string; tally: Tally }>();
  for (const event of events) {
    for (const place of placesFor(event)) {
      const id = `${place.dimension}\u0000${place.key}`;
      let entry = tallies.get(id);
      if (!entry) {
        entry = { ...place, tally: emptyTally() };
        tallies.set(id, entry);
      }
      addTo(entry.tally, event, place.dimension);
    }
  }
  return [...tallies.values()].map(({ dimension, key, tally }) => ({
    dimension,
    key,
    visitors: tally.visitors.size,
    views: tally.views,
    durationMs: tally.durationMs,
    durationCount: tally.durationCount,
    conversions: tally.conversions,
    value: tally.value,
  }));
}
