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
import type {
  WordPressImportFound,
  WordPressImportMapping,
  WordPressImportProgress,
} from "./wordpress-import.schema.js";
import { wordpressImportItemStatuses, wordpressImportStatuses } from "./wordpress-import.schema.js";

/**
 * One WordPress import, from the uploaded export to the finished report.
 *
 * - `status`: "ready" once the file is read and waiting for the mapping, "running",
 *   "paused" when it stopped part way (the server restarted, or the database went away)
 *   and can be resumed, then "complete".
 * - `mapping` is what the person chose on the mapping screen: which collection posts and
 *   pages go into, which taxonomies, where images come from.
 * - `contentZipFile` is an uploaded zip of the old site's wp-content folder, kept in the
 *   imports folder until the import finishes.
 *
 * Like the backups list, this has no reference to users, so restoring a backup leaves it be.
 */
export const wordpressImportsTable = pgTable(
  "wordpress_imports",
  {
    id: id(),
    tenantId: tenantId(),
    filename: text("filename").notNull(),
    siteTitle: text("site_title").notNull().default(""),
    siteAddress: text("site_address").notNull().default(""),
    status: text("status", { enum: wordpressImportStatuses }).notNull().default("ready"),
    found: jsonb("found").$type<WordPressImportFound>().notNull(),
    mapping: jsonb("mapping").$type<WordPressImportMapping>(),
    progress: jsonb("progress")
      .$type<WordPressImportProgress>()
      .notNull()
      .default({ done: 0, total: 0 }),
    contentZipFile: text("content_zip_file"),
    startedBy: uuid("started_by"),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [index("wordpress_imports_tenant_created_idx").on(table.tenantId, table.createdAt)],
);

/**
 * One thing to bring in: an author, a category or tag, an attachment, an image found in
 * a post, a page or a post. Each is done (and marked done) in its own transaction, which
 * is what makes an import resumable: a resumed import skips everything already done.
 *
 * `targetId` is what it became in Lintel (a user, term, asset or entry); `details` holds
 * what the report needs, such as blocks kept as HTML or a slug that had to change.
 */
export const wordpressImportItemsTable = pgTable(
  "wordpress_import_items",
  {
    id: id(),
    tenantId: tenantId(),
    importId: uuid("import_id")
      .notNull()
      .references(() => wordpressImportsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sourceId: text("source_id").notNull(),
    position: integer("position").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: wordpressImportItemStatuses }).notNull().default("pending"),
    targetId: uuid("target_id"),
    message: text("message"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("wordpress_import_items_source_unique").on(
      table.importId,
      table.kind,
      table.sourceId,
    ),
    index("wordpress_import_items_position_idx").on(table.importId, table.status, table.position),
  ],
);

export type WordPressImportRow = typeof wordpressImportsTable.$inferSelect;
export type WordPressImportItemRow = typeof wordpressImportItemsTable.$inferSelect;
export type NewWordPressImportItemRow = typeof wordpressImportItemsTable.$inferInsert;
