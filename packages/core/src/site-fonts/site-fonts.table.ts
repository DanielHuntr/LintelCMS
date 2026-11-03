import type { FontCategory, SiteFontSource } from "@lintel/builder-model";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { sitesTable } from "../sites/sites.table.js";

// Written out here (and checked against builder-model's) so drizzle-kit can read this file alone.
const fontCategories = [
  "sans",
  "serif",
  "display",
  "script",
  "mono",
] as const satisfies readonly FontCategory[];
const siteFontSources = ["upload", "google", "adobe"] as const satisfies readonly SiteFontSource[];

/** One file of a site font: a media library item, and which weight and style it is. */
export interface StoredFontFile {
  assetId: string;
  weight: string;
  style: "normal" | "italic";
  format: "woff2" | "woff" | "truetype" | "opentype";
  /** For files split by alphabet (Google Fonts'): the characters this one covers. */
  unicodeRange?: string;
}

/**
 * A font family the whole site can use (see README.md). One row per family:
 *
 * - `upload`: files the maker uploaded to the media library. `licenceConfirmedAt` and
 *   `licenceConfirmedBy` record who said they may use it on the web, and when.
 * - `google`: a Google Fonts family Lintel downloaded into the media library; `sourceId`
 *   is its id in the list it came from ("roboto").
 * - `adobe`: a family from an Adobe Fonts web project, which Adobe serves; `sourceId` is the
 *   project's ID, shared by every family of that project, and `files` stays empty.
 *
 * Each site has its own fonts, and a family name appears once per site.
 */
export const siteFontsTable = pgTable(
  "site_fonts",
  {
    id: id(),
    tenantId: tenantId(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    family: text("family").notNull(),
    category: text("category", { enum: fontCategories }).notNull().default("sans"),
    source: text("source", { enum: siteFontSources }).notNull(),
    sourceId: text("source_id"),
    files: jsonb("files").$type<StoredFontFile[]>().notNull().default([]),
    licenceConfirmedAt: timestamp("licence_confirmed_at", { withTimezone: true }),
    licenceConfirmedBy: uuid("licence_confirmed_by"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("site_fonts_site_family_unique").on(table.tenantId, table.siteId, table.family),
  ],
);

export type SiteFontRow = typeof siteFontsTable.$inferSelect;
export type NewSiteFontRow = typeof siteFontsTable.$inferInsert;
