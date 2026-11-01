import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";
import { type PriceRounding, priceRoundingRules } from "../money/price-conversion.js";

/**
 * Where the shop sells, and in what currency: "United Kingdom" in GBP, "Europe" in EUR.
 *
 * Exactly one market is the primary one. Its currency is the shop's own: every variant has
 * a price in it, and other markets convert from it at `exchangeRate` (rounded by
 * `priceRounding`) unless the variant has a price set by hand for their currency.
 *
 * A country belongs to at most one market (checked in markets.service.ts).
 */
export const marketsTable = pgTable(
  "shop_markets",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    currency: text("currency").notNull(),
    countries: jsonb("countries").$type<string[]>().notNull().default([]),
    isPrimary: boolean("is_primary").notNull().default(false),
    /** Units of this market's currency per unit of the primary currency. 1 for the primary. */
    exchangeRate: doublePrecision("exchange_rate").notNull().default(1),
    priceRounding: text("price_rounding", { enum: priceRoundingRules })
      .$type<PriceRounding>()
      .notNull()
      .default("exact"),
    /** Prices shown with tax in them (UK, EU), or with tax added at checkout (US). */
    pricesIncludeTax: boolean("prices_include_tax").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("shop_markets_handle_idx").on(table.tenantId, table.handle),
    index("shop_markets_tenant_idx").on(table.tenantId, table.position),
  ],
);

export type MarketRow = typeof marketsTable.$inferSelect;
export type NewMarketRow = typeof marketsTable.$inferInsert;
