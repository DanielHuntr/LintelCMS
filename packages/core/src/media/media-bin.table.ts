import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenantId } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

/**
 * What a deleted file's row was, so it can come back exactly as it was: the same id, so
 * links to it work again. Dates are ISO strings, as JSON keeps them.
 */
export interface BinnedAsset {
  siteId: string | null;
  filename: string;
  storageKey: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  focalX: number;
  focalY: number;
  contentHash: string;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Files deleted from the media library, kept with their bytes until the bin is emptied (see
 * media-bin.service.ts). `id` is the asset's own id. Only files nothing uses can be deleted,
 * so nothing points at a binned file.
 */
export const binnedAssetsTable = pgTable(
  "binned_assets",
  {
    id: uuid("id").primaryKey(),
    tenantId: tenantId(),
    filename: text("filename").notNull(),
    asset: jsonb("asset").$type<BinnedAsset>().notNull(),
    deletedBy: uuid("deleted_by").references(() => usersTable.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("binned_assets_tenant_deleted_idx").on(table.tenantId, table.deletedAt)],
);

export type BinnedAssetRow = typeof binnedAssetsTable.$inferSelect;
export type NewBinnedAssetRow = typeof binnedAssetsTable.$inferInsert;
