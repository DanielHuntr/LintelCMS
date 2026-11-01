import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";
import { checkoutsTable } from "../checkouts/checkouts.table.js";
import { variantsTable } from "../products/products.table.js";

/**
 * A place stock is kept: a warehouse, a shop, a garage. Orders take stock from the active
 * locations in `position` order. A shop gets one, "Main location", the first time it's needed.
 */
export const inventoryLocationsTable = pgTable(
  "shop_inventory_locations",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (table) => [index("shop_inventory_locations_tenant_idx").on(table.tenantId, table.position)],
);

/** How many of a variant are physically at a location. Only tracked variants have levels. */
export const inventoryLevelsTable = pgTable(
  "shop_inventory_levels",
  {
    id: id(),
    tenantId: tenantId(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variantsTable.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocationsTable.id, { onDelete: "cascade" }),
    onHand: integer("on_hand").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("shop_inventory_levels_variant_idx").on(table.variantId, table.locationId),
  ],
);

export const reservationStatuses = ["active", "committed", "released"] as const;
export type ReservationStatus = (typeof reservationStatuses)[number];

/**
 * Stock held for a checkout while the customer pays, so two people can't both buy the last
 * one. Available = on hand − active reservations that haven't expired. When the payment
 * arrives the reservation is `committed` (and stock leaves the shelf); when the checkout is
 * abandoned it is `released`, or simply ignored once `expiresAt` has passed.
 */
export const inventoryReservationsTable = pgTable(
  "shop_inventory_reservations",
  {
    id: id(),
    tenantId: tenantId(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variantsTable.id, { onDelete: "cascade" }),
    checkoutId: uuid("checkout_id")
      .notNull()
      .references(() => checkoutsTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    status: text("status", { enum: reservationStatuses }).notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (table) => [
    index("shop_inventory_reservations_variant_idx").on(
      table.variantId,
      table.status,
      table.expiresAt,
    ),
    index("shop_inventory_reservations_checkout_idx").on(table.checkoutId),
  ],
);

export type InventoryLocationRow = typeof inventoryLocationsTable.$inferSelect;
export type InventoryLevelRow = typeof inventoryLevelsTable.$inferSelect;
export type InventoryReservationRow = typeof inventoryReservationsTable.$inferSelect;
