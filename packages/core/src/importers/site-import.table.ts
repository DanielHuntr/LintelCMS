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
import { id, tenantId, timestamps } from "../database/columns.js";
import {
  importSources,
  type SiteImportFound,
  type SiteImportMapping,
  type SiteImportProgress,
  siteImportItemStatuses,
  siteImportStatuses,
} from "./site-import.schema.js";

/**
 * One move from Webflow, Framer, Statamic or Umbraco, from the uploaded files to the
 * finished report; WordPress has its own table (src/wordpress-import), which these follow.
 *
 * - `status`: "ready" while waiting for the mapping, "running", "paused" when it stopped
 *   part way (the server restarted) and can be resumed, then "complete".
 * - `archiveFile` is the uploaded zip, kept in the imports folder until the import
 *   finishes, because pictures are read from it as they're brought in.
 *
 * Like the WordPress imports, this has no reference to users, so restoring a backup leaves
 * it be.
 */
export const siteImportsTable = pgTable(
  "site_imports",
  {
    id: id(),
    tenantId: tenantId(),
    source: text("source", { enum: importSources }).notNull(),
    filename: text("filename").notNull(),
    siteTitle: text("site_title").notNull().default(""),
    siteAddress: text("site_address").notNull().default(""),
    status: text("status", { enum: siteImportStatuses }).notNull().default("ready"),
    found: jsonb("found").$type<SiteImportFound>().notNull(),
    mapping: jsonb("mapping").$type<SiteImportMapping>(),
    /** Picture hosts the files themselves use, such as Webflow's CDN. */
    mediaHosts: jsonb("media_hosts").$type<string[]>().notNull().default([]),
    progress: jsonb("progress")
      .$type<SiteImportProgress>()
      .notNull()
      .default({ done: 0, total: 0 }),
    archiveFile: text("archive_file"),
    startedBy: uuid("started_by"),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [index("site_imports_tenant_created_idx").on(table.tenantId, table.createdAt)],
);

/**
 * One thing to bring in. Each is done (and marked done) in its own transaction, which is
 * what makes an import resumable: a resumed import skips everything already done.
 * `targetId` is what it became here; `details` holds what the report needs.
 */
export const siteImportItemsTable = pgTable(
  "site_import_items",
  {
    id: id(),
    tenantId: tenantId(),
    importId: uuid("import_id")
      .notNull()
      .references(() => siteImportsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sourceId: text("source_id").notNull(),
    position: integer("position").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: siteImportItemStatuses }).notNull().default("pending"),
    targetId: uuid("target_id"),
    message: text("message"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("site_import_items_source_unique").on(table.importId, table.kind, table.sourceId),
    index("site_import_items_position_idx").on(table.importId, table.status, table.position),
  ],
);

export type SiteImportRow = typeof siteImportsTable.$inferSelect;
export type SiteImportItemRow = typeof siteImportItemsTable.$inferSelect;
export type NewSiteImportItemRow = typeof siteImportItemsTable.$inferInsert;
