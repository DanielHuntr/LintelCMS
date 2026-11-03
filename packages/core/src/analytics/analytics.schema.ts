import { z } from "zod";

/** What the page's beacon sends. Every field is short; anything longer is cut, never kept. */
export const collectRequestSchema = z.object({
  kind: z.enum(["view", "leave", "outbound", "custom"]),
  path: z.string().max(2000),
  referrer: z.string().max(2000).optional(),
  /** The window's width in pixels, for phone, tablet or desktop. */
  width: z.number().int().min(0).max(100_000).optional(),
  durationMs: z.number().min(0).max(86_400_000).optional(),
  /** The link's address for "outbound"; the event's name for "custom". */
  name: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
  campaign: z.string().max(200).optional(),
  /** The page's host, so visits from one page of the site to another aren't "referrals". */
  host: z.string().max(253).optional(),
});
export type CollectRequest = z.infer<typeof collectRequestSchema>;

export const collectQuerySchema = z.object({ site: z.string().max(100).optional() });

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-03.");

export const statsRanges = ["today", "7d", "30d", "custom"] as const;
export type StatsRange = (typeof statsRanges)[number];

export const statsQuerySchema = z.object({
  range: z.enum(statsRanges).default("7d"),
  from: isoDay.optional(),
  to: isoDay.optional(),
  /** Only this page's figures. */
  path: z.string().max(300).optional(),
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;

export const entryStatsParamsSchema = z.object({ entryId: z.uuid() });

export interface Totals {
  visitors: number;
  views: number;
  /** Average time on a page, in whole seconds; null when no visit said how long it was. */
  averageSeconds: number | null;
  conversions: number;
  /** Conversions for every 100 visitors, to one decimal place, never above 100. */
  conversionRate: number | null;
  /** Money from orders, in the shop currency's smallest unit. */
  value: number;
}

export interface Row {
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

export interface VisitorStats {
  period: Period;
  previousPeriod: Period;
  totals: Totals;
  previousTotals: Totals;
  /** One row a day, oldest first, including days without visitors. */
  days: { day: string; visitors: number; views: number }[];
  pages: Row[];
  sources: Row[];
  campaigns: Row[];
  devices: Row[];
  countries: Row[];
  goals: Row[];
  events: Row[];
  outbound: Row[];
}

export interface PageVisitorStats {
  path: string | null;
  period: Period;
  totals: Totals;
  previousTotals: Totals;
  days: { day: string; visitors: number; views: number }[];
}
