import { pgTable, text } from "drizzle-orm/pg-core";
import { tenantId, timestamps } from "../../database/columns.js";

/**
 * Every Stripe webhook event already handled, by Stripe's event id. Stripe sends an event
 * again when it isn't sure it arrived, so the handler records the id in the same transaction
 * as the work it does: a repeat finds the id and does nothing, and a failure leaves no id,
 * so Stripe's retry is handled properly.
 */
export const stripeEventsTable = pgTable("shop_stripe_events", {
  id: text("id").primaryKey(),
  tenantId: tenantId(),
  type: text("type").notNull(),
  ...timestamps(),
});
