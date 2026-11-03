import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId } from "../database/columns.js";
import { sitesTable } from "../sites/sites.table.js";
import { analyticsEventKinds, deviceClasses, type EventProperties } from "./analytics-events.js";

/**
 * One thing a visitor did on the website: opened a page, left it, followed a link to another
 * site, reached a goal (sent a form, paid for an order) or did something the site names
 * itself. Kept only for a short while (`retentionDays`, 30 by default) so the daily figures
 * can be worked out; after that only `analytics_daily` remains.
 *
 * Nothing here can identify a person: there is no address, no cookie and no account. The
 * `visitorHash` changes every day and can't be traced back (see visitor-hash.ts).
 */
export const analyticsEventsTable = pgTable(
  "analytics_events",
  {
    id: id(),
    tenantId: tenantId(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    /** The day it happened, "2026-11-03" in UTC, which the rollups group by. */
    day: text("day").notNull(),
    kind: text("kind", { enum: analyticsEventKinds }).notNull(),
    /** Null for goals the server records on its own (an order paid by the payment service). */
    visitorHash: text("visitor_hash"),
    /** The page's path, without its query or anchor: "/about". */
    path: text("path").notNull().default(""),
    /** The other website that sent them, or the `utm_source` they came with: "google.com". */
    source: text("source").notNull().default(""),
    campaign: text("campaign").notNull().default(""),
    device: text("device", { enum: deviceClasses }),
    /** Two letters ("GB"), from the browser's language. Empty when it doesn't say. */
    country: text("country").notNull().default(""),
    /** For "leave": how long the page was open and in view. */
    durationMs: integer("duration_ms"),
    /** The goal or event name ("form:contact", "order", "signup"), or the link's domain. */
    name: text("name").notNull().default(""),
    /** Money, in the currency's smallest unit, for orders. */
    value: integer("value").notNull().default(0),
    currency: text("currency").notNull().default(""),
    /** Room for later features (experiments' variants, say) without a new column. */
    properties: jsonb("properties").$type<EventProperties>().notNull().default({}),
  },
  (table) => [
    index("analytics_events_site_day_idx").on(table.tenantId, table.siteId, table.day),
    index("analytics_events_occurred_idx").on(table.tenantId, table.occurredAt),
  ],
);

/**
 * The figures for one day, one site and one thing counted: the whole site ("total", key ""),
 * a page ("page", key "/about"), where people came from ("source"), a campaign, a device,
 * a country, a goal or a link to another site ("outbound"). Kept for good.
 */
export const analyticsDailyTable = pgTable(
  "analytics_daily",
  {
    id: id(),
    tenantId: tenantId(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    dimension: text("dimension").notNull(),
    key: text("key").notNull().default(""),
    visitors: integer("visitors").notNull().default(0),
    views: integer("views").notNull().default(0),
    /** Time on page: the total, and how many visits it is the total of. */
    durationMs: integer("duration_ms").notNull().default(0),
    durationCount: integer("duration_count").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    value: integer("value").notNull().default(0),
  },
  (table) => [
    uniqueIndex("analytics_daily_unique").on(
      table.tenantId,
      table.siteId,
      table.day,
      table.dimension,
      table.key,
    ),
  ],
);

/**
 * Today's secret for visitor hashes, one per tenant. Yesterday's is deleted as soon as the
 * day is over, so nobody (not even someone with the database) can work out who a hash was
 * or link one day's visitors to another's.
 */
export const analyticsSaltsTable = pgTable(
  "analytics_salts",
  {
    id: id(),
    tenantId: tenantId(),
    day: text("day").notNull(),
    salt: text("salt").notNull(),
  },
  (table) => [uniqueIndex("analytics_salts_tenant_day_unique").on(table.tenantId, table.day)],
);

export type AnalyticsEventRow = typeof analyticsEventsTable.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEventsTable.$inferInsert;
export type AnalyticsDailyRow = typeof analyticsDailyTable.$inferSelect;
export type NewAnalyticsDailyRow = typeof analyticsDailyTable.$inferInsert;
