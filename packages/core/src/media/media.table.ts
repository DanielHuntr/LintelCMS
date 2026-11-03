import { index, integer, pgTable, real, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { sitesTable } from "../sites/sites.table.js";
import { usersTable } from "../users/users.table.js";

/**
 * One uploaded file: an image, a PDF, a spreadsheet. The bytes live in storage (see
 * storage-driver.ts) under `storageKey`; this row holds what editors see and change.
 *
 * - `width` and `height` are null for documents. For photos they are as displayed,
 *   after the camera's rotation is applied, so the focal point matches what people see.
 * - The focal point is where the subject is, from 0 to 1 across and down. Crops keep it in view.
 * - `contentHash` (SHA-256 of the bytes) is unique per tenant, so uploading the same file
 *   twice gives back the asset that already exists instead of a duplicate.
 * - `credit` says who made the file and under what licence, such as a free photo's
 *   "Photo by Ana Ruiz, CC BY 4.0", for sites that must credit what they use. Empty for
 *   most files.
 * - `siteId` puts the asset in one site's folder. Null means the shared library, which is
 *   where everything goes unless someone chooses a site's folder. Every site can use any asset.
 */
export const assetsTable = pgTable(
  "assets",
  {
    id: id(),
    tenantId: tenantId(),
    siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
    filename: text("filename").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    credit: text("credit").notNull().default(""),
    focalX: real("focal_x").notNull().default(0.5),
    focalY: real("focal_y").notNull().default(0.5),
    contentHash: text("content_hash").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("assets_tenant_content_hash_unique").on(table.tenantId, table.contentHash),
    index("assets_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export type AssetRow = typeof assetsTable.$inferSelect;
export type NewAssetRow = typeof assetsTable.$inferInsert;
