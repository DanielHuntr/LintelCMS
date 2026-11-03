import { apiRequest, apiUrl } from "../api/client.js";
import { siteHeaders } from "../sites/currentSite.js";

/** The Visitors plugin's figures, as the API sends them (see packages/core/src/analytics). */

export type StatsRange = "today" | "7d" | "30d" | "custom";

export interface StatsChoice {
  range: StatsRange;
  from?: string;
  to?: string;
}

export interface Totals {
  visitors: number;
  views: number;
  averageSeconds: number | null;
  conversions: number;
  conversionRate: number | null;
  value: number;
}

export interface StatsRow {
  key: string;
  visitors: number;
  views: number;
  conversions: number;
  averageSeconds: number | null;
}

export interface Period {
  from: string;
  to: string;
}

export interface DayFigures {
  day: string;
  visitors: number;
  views: number;
}

export interface VisitorStats {
  period: Period;
  previousPeriod: Period;
  totals: Totals;
  previousTotals: Totals;
  days: DayFigures[];
  pages: StatsRow[];
  sources: StatsRow[];
  campaigns: StatsRow[];
  devices: StatsRow[];
  countries: StatsRow[];
  goals: StatsRow[];
  events: StatsRow[];
  outbound: StatsRow[];
  /** Visitors of each A/B test version, keyed "<test id>:<version>". */
  versions: StatsRow[];
}

export interface PageVisitorStats {
  path: string | null;
  period: Period;
  totals: Totals;
  previousTotals: Totals;
  days: DayFigures[];
}

export interface AnalyticsSettings {
  retentionDays: number;
  countOnlyAfterConsent: boolean;
}

export function statsQuery(choice: StatsChoice): string {
  const query = new URLSearchParams({ range: choice.range });
  if (choice.range === "custom" && choice.from && choice.to) {
    query.set("from", choice.from);
    query.set("to", choice.to);
  }
  return query.toString();
}

export function getVisitorStats(choice: StatsChoice) {
  return apiRequest<VisitorStats>(`/analytics/stats?${statsQuery(choice)}`);
}

export function getEntryVisitorStats(entryId: string) {
  return apiRequest<PageVisitorStats>(`/analytics/entries/${entryId}?range=7d`);
}

export function getAnalyticsSettings() {
  return apiRequest<AnalyticsSettings>("/plugins/analytics/settings");
}

export function saveAnalyticsSettings(settings: AnalyticsSettings) {
  return apiRequest<AnalyticsSettings>("/plugins/analytics/settings", {
    method: "PUT",
    body: settings,
  });
}

/** Downloads the spreadsheet; a plain link wouldn't carry the site header. */
export async function downloadVisitorStats(choice: StatsChoice): Promise<void> {
  const response = await fetch(`${apiUrl}/analytics/export?${statsQuery(choice)}`, {
    credentials: "include",
    headers: siteHeaders(),
  });
  if (!response.ok) throw new Error(response.statusText);
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "visitors.csv";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
