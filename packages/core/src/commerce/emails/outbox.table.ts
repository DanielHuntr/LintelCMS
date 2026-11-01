import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";

/**
 * Emails the shop would have sent, kept instead of sending them. This is the outbox email
 * provider's storage: the default while developing, so order emails can be read in the
 * admin (Shop → Settings → Emails) without setting up a mail service.
 */
export const outboxEmailsTable = pgTable(
  "shop_outbox_emails",
  {
    id: id(),
    tenantId: tenantId(),
    kind: text("kind").notNull(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    text: text("text").notNull(),
    html: text("html").notNull(),
    orderId: uuid("order_id"),
    ...timestamps(),
  },
  (table) => [index("shop_outbox_emails_created_idx").on(table.tenantId, table.createdAt)],
);

export type OutboxEmailRow = typeof outboxEmailsTable.$inferSelect;
