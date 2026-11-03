import { boolean, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "@lintel/core/plugin";

/**
 * The site's connection to its newsletter service: which service, the API key, the list
 * people join and whether they confirm by email first. One row per tenant. Kept in the
 * add-on's own table rather than its settings, because settings can be read by anyone who
 * can see settings, and the key must never leave the server.
 */
export const newsletterConnectionTable = pgTable(
  "newsletter_connection",
  {
    id: id(),
    tenantId: tenantId(),
    provider: text("provider").notNull(),
    apiKey: text("api_key").notNull(),
    listId: text("list_id").notNull(),
    listName: text("list_name").notNull().default(""),
    doubleOptIn: boolean("double_opt_in").notNull().default(true),
    /** Brevo only: the confirmation email's template, needed for double opt-in. */
    brevoTemplateId: integer("brevo_template_id"),
    /** Brevo only: the page people land on after confirming. */
    brevoConfirmUrl: text("brevo_confirm_url").notNull().default(""),
    ...timestamps(),
  },
  (table) => [uniqueIndex("newsletter_connection_tenant_idx").on(table.tenantId)],
);

export type NewsletterConnectionRow = typeof newsletterConnectionTable.$inferSelect;
export type NewNewsletterConnectionRow = typeof newsletterConnectionTable.$inferInsert;
