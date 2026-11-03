import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { Site } from "../sites/sites.table.js";
import type { RollupDimension } from "./analytics-events.js";
import { AnalyticsRangeBackwardsError, AnalyticsRangeTooLongError } from "./analytics.errors.js";
import { listDailyFigures } from "./analytics.repository.js";
import type {
  PageVisitorStats,
  Period,
  Row,
  StatsQuery,
  Totals,
  VisitorStats,
} from "./analytics.schema.js";
import type { AnalyticsDailyRow } from "./analytics.table.js";
import { rollUpSiteDay } from "./rollups.service.js";
import { dayOf } from "./visitor-signals.js";

/** Reading the daily figures for the Visitors screen, a page's panel and the export. */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const LONGEST_RANGE_DAYS = 366;
const ROWS_SHOWN = 10;

function addDays(day: string, days: number): string {
  return dayOf(new Date(Date.parse(`${day}T00:00:00Z`) + days * ONE_DAY_MS));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / ONE_DAY_MS);
}

/** The chosen days, and the same number of days just before them, for comparing. */
export function periodsFor(query: Pick<StatsQuery, "range" | "from" | "to">, now: Date) {
  const today = dayOf(now);
  let period: Period;
  if (query.range === "custom" && query.from && query.to) {
    if (query.from > query.to) throw new AnalyticsRangeBackwardsError();
    if (daysBetween(query.from, query.to) + 1 > LONGEST_RANGE_DAYS) {
      throw new AnalyticsRangeTooLongError(LONGEST_RANGE_DAYS);
    }
    period = { from: query.from, to: query.to };
  } else {
    const length = query.range === "today" ? 1 : query.range === "30d" ? 30 : 7;
    period = { from: addDays(today, -(length - 1)), to: today };
  }
  const length = daysBetween(period.from, period.to) + 1;
  const previousPeriod = { from: addDays(period.from, -length), to: addDays(period.from, -1) };
  return { period, previousPeriod };
}

/** Today's figures are counted again when someone looks, at most every half a minute. */
const FRESH_FOR_MS = 30_000;
const lastCounted = new Map<string, number>();

async function freshenToday(
  database: DatabaseOrTransaction,
  site: Site,
  period: Period,
  now: Date,
) {
  const today = dayOf(now);
  if (period.to < today || period.from > today) return;
  const last = lastCounted.get(site.id);
  if (last !== undefined && now.getTime() - last < FRESH_FOR_MS) return;
  lastCounted.set(site.id, now.getTime());
  await rollUpSiteDay(database, site.id, today);
}

/** For tests: count today again on the next look. */
export function forgetFreshness(): void {
  lastCounted.clear();
}

async function readFigures(
  database: DatabaseOrTransaction,
  site: Site,
  period: Period,
  filter: { dimensions?: readonly RollupDimension[]; key?: string } = {},
) {
  return listDailyFigures(database, {
    tenantId: DEFAULT_TENANT_ID,
    siteId: site.id,
    fromDay: period.from,
    toDay: period.to,
    ...filter,
  });
}

export function totalsOf(rows: readonly AnalyticsDailyRow[]): Totals {
  const sum = (pick: (row: AnalyticsDailyRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const visitors = sum((row) => row.visitors);
  const conversions = sum((row) => row.conversions);
  const durationCount = sum((row) => row.durationCount);
  return {
    visitors,
    views: sum((row) => row.views),
    averageSeconds:
      durationCount > 0 ? Math.round(sum((row) => row.durationMs) / durationCount / 1000) : null,
    conversions,
    conversionRate:
      visitors > 0 ? Math.min(100, Math.round((conversions / visitors) * 1000) / 10) : null,
    value: sum((row) => row.value),
  };
}

function daysOf(rows: readonly AnalyticsDailyRow[], period: Period) {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const days: VisitorStats["days"] = [];
  for (let day = period.from; day <= period.to; day = addDays(day, 1)) {
    const row = byDay.get(day);
    days.push({ day, visitors: row?.visitors ?? 0, views: row?.views ?? 0 });
  }
  return days;
}

/** One dimension's rows over the period, biggest first. */
export function rowsFor(
  figures: readonly AnalyticsDailyRow[],
  dimension: RollupDimension,
  limit = ROWS_SHOWN,
): Row[] {
  const grouped = new Map<string, AnalyticsDailyRow[]>();
  for (const row of figures) {
    if (row.dimension !== dimension) continue;
    grouped.set(row.key, [...(grouped.get(row.key) ?? []), row]);
  }
  return [...grouped.entries()]
    .map(([key, rows]) => {
      const totals = totalsOf(rows);
      return {
        key,
        visitors: totals.visitors,
        views: totals.views,
        conversions: totals.conversions,
        averageSeconds: totals.averageSeconds,
      };
    })
    .sort(
      (a, b) =>
        b.visitors - a.visitors ||
        b.views - a.views ||
        b.conversions - a.conversions ||
        a.key.localeCompare(b.key),
    )
    .slice(0, limit);
}

export async function readVisitorStats(
  database: DatabaseOrTransaction,
  site: Site,
  query: StatsQuery,
  now: Date = new Date(),
): Promise<VisitorStats> {
  const { period, previousPeriod } = periodsFor(query, now);
  await freshenToday(database, site, period, now);
  const [figures, previousTotalRows] = await Promise.all([
    readFigures(database, site, period),
    readFigures(database, site, previousPeriod, { dimensions: ["total"] }),
  ]);
  const totalRows = figures.filter((row) => row.dimension === "total");
  return {
    period,
    previousPeriod,
    totals: totalsOf(totalRows),
    previousTotals: totalsOf(previousTotalRows),
    days: daysOf(totalRows, period),
    pages: rowsFor(figures, "page"),
    sources: rowsFor(figures, "source"),
    campaigns: rowsFor(figures, "campaign"),
    devices: rowsFor(figures, "device"),
    countries: rowsFor(figures, "country"),
    goals: rowsFor(figures, "goal"),
    events: rowsFor(figures, "event"),
    outbound: rowsFor(figures, "outbound"),
    versions: rowsFor(figures, "version"),
  };
}

/** One page's figures, by its path on the site. */
export async function readPageStats(
  database: DatabaseOrTransaction,
  site: Site,
  path: string | null,
  query: StatsQuery,
  now: Date = new Date(),
): Promise<PageVisitorStats> {
  const { period, previousPeriod } = periodsFor(query, now);
  if (path === null) {
    const empty = totalsOf([]);
    return { path, period, totals: empty, previousTotals: empty, days: daysOf([], period) };
  }
  await freshenToday(database, site, period, now);
  const filter = { dimensions: ["page"] as const, key: path };
  const [rows, previousRows] = await Promise.all([
    readFigures(database, site, period, filter),
    readFigures(database, site, previousPeriod, filter),
  ]);
  return {
    path,
    period,
    totals: totalsOf(rows),
    previousTotals: totalsOf(previousRows),
    days: daysOf(rows, period),
  };
}

const dimensionLabels: Record<RollupDimension, string> = {
  total: "Whole site",
  page: "Page",
  source: "Came from",
  campaign: "Campaign",
  device: "Device",
  country: "Country",
  goal: "Goal",
  outbound: "Link to another site",
  event: "Event",
  version: "A/B test version",
};

/** Every daily figure in the period, one line each, for a spreadsheet. */
export async function exportVisitorStatsAsCsv(
  database: DatabaseOrTransaction,
  site: Site,
  query: StatsQuery,
  now: Date = new Date(),
): Promise<{ filename: string; csv: string }> {
  const { period } = periodsFor(query, now);
  await freshenToday(database, site, period, now);
  const figures = await readFigures(database, site, period);
  const header = [
    "Day",
    "What",
    "Which",
    "Visitors",
    "Page views",
    "Average seconds on page",
    "Goals reached",
    "Order value",
  ];
  const lines = figures.map((row) => {
    const average =
      row.durationCount > 0 ? Math.round(row.durationMs / row.durationCount / 1000) : "";
    return [
      row.day,
      dimensionLabels[row.dimension as RollupDimension] ?? row.dimension,
      row.dimension === "source" && row.key === "" ? "Direct" : row.key,
      row.visitors,
      row.views,
      average,
      row.conversions,
      row.value,
    ];
  });
  const csv = `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
  return { filename: `visitors-${site.handle}-${period.from}-to-${period.to}.csv`, csv };
}

/** Quotes a cell when needed, and stops spreadsheets running it as a formula. */
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
