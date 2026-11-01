import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";

/** Amounts in minor units, by currency: `{ "GBP": 495, "EUR": 595 }`. */
export type AmountsByCurrency = Record<string, number>;

export const shippingRateKinds = ["flat", "weight"] as const;
export type ShippingRateKind = (typeof shippingRateKinds)[number];

/** One step of a weight-based rate: parcels up to `upToGrams` cost `amounts`. */
export interface WeightBracket {
  /** null for the last step, with no upper limit. */
  upToGrams: number | null;
  amounts: AmountsByCurrency;
}

/** Countries that share shipping rates: "UK", "Europe", "Rest of world". */
export const shippingZonesTable = pgTable(
  "shop_shipping_zones",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    countries: jsonb("countries").$type<string[]>().notNull().default([]),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (table) => [index("shop_shipping_zones_tenant_idx").on(table.tenantId, table.position)],
);

/**
 * A way of shipping to a zone, such as "Standard, 3–5 days".
 *
 * - `flat` costs `amounts` whatever the parcel weighs;
 * - `weight` costs the first bracket the parcel fits in, and isn't offered above the last;
 * - either is free once the order's subtotal reaches `freeOverAmounts` for its currency.
 *
 * A currency missing from the amounts is converted from the primary currency by the
 * market's exchange rate, as prices are.
 */
export const shippingRatesTable = pgTable(
  "shop_shipping_rates",
  {
    id: id(),
    tenantId: tenantId(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => shippingZonesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: shippingRateKinds }).notNull().default("flat"),
    amounts: jsonb("amounts").$type<AmountsByCurrency>().notNull().default({}),
    weightBrackets: jsonb("weight_brackets").$type<WeightBracket[]>().notNull().default([]),
    freeOverAmounts: jsonb("free_over_amounts").$type<AmountsByCurrency>(),
    deliveryEstimate: text("delivery_estimate").notNull().default(""),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (table) => [index("shop_shipping_rates_zone_idx").on(table.zoneId, table.position)],
);

export type ShippingZoneRow = typeof shippingZonesTable.$inferSelect;
export type ShippingRateRow = typeof shippingRatesTable.$inferSelect;
export type NewShippingRateRow = typeof shippingRatesTable.$inferInsert;
