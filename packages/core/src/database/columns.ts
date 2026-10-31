import { text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Columns that almost every table shares.
 *
 * `tenantId` is on every table from day one. A self-hosted install only ever has one tenant
 * ("default"), but the future cloud version will use this column to keep customers apart.
 * Adding it now is cheap; adding it to a live database later is not. See docs/decisions/0003.
 */
export const DEFAULT_TENANT_ID = "default";

export const id = () => uuid("id").primaryKey().defaultRandom();

export const tenantId = () => text("tenant_id").notNull().default(DEFAULT_TENANT_ID);

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
