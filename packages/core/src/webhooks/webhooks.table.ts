import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { appsTable } from "../apps/apps.table.js";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";
import type { WebhookEventName } from "./webhook-events.js";

/**
 * An address Lintel tells when something happens, such as a site builder that rebuilds
 * when a page is published. `secret` signs every request (see webhook-signatures.ts); it
 * is kept as it is, because signing needs it, and only admins can see it.
 */
export const webhooksTable = pgTable(
  "webhooks",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    events: jsonb("events").$type<WebhookEventName[]>().notNull(),
    secret: text("secret").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    /**
     * Set for an app's webhook subscriptions. They are listed with the app rather than in
     * Settings → Webhooks, are signed with the app's client secret, and go when it does.
     */
    appId: uuid("app_id").references(() => appsTable.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (table) => [
    index("webhooks_tenant_idx").on(table.tenantId),
    index("webhooks_app_idx").on(table.appId),
  ],
);

export const webhookDeliveryStatuses = ["pending", "delivered", "failed"] as const;
export type WebhookDeliveryStatus = (typeof webhookDeliveryStatuses)[number];

/**
 * One event sent (or still to be sent) to one webhook: the delivery log.
 *
 * - `pending` deliveries are sent when `nextAttemptAt` comes round; each failure pushes
 *   it later (see webhook-retries.ts) until the attempts run out and it is `failed`.
 * - The payload is kept exactly as first sent, so a retry or a resend carries the same body.
 */
export const webhookDeliveriesTable = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    tenantId: tenantId(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooksTable.id, { onDelete: "cascade" }),
    event: text("event").$type<WebhookEventName>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: webhookDeliveryStatuses }).notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    responseStatus: integer("response_status"),
    /** The start of the receiver's answer, or what went wrong, for the log. */
    responseSummary: text("response_summary"),
    ...timestamps(),
  },
  (table) => [
    index("webhook_deliveries_webhook_idx").on(table.webhookId, table.createdAt),
    // The scheduler looks for pending deliveries that are due.
    index("webhook_deliveries_due_idx").on(table.status, table.nextAttemptAt),
  ],
);

export type WebhookRow = typeof webhooksTable.$inferSelect;
export type NewWebhookRow = typeof webhooksTable.$inferInsert;
export type WebhookDeliveryRow = typeof webhookDeliveriesTable.$inferSelect;
export type NewWebhookDeliveryRow = typeof webhookDeliveriesTable.$inferInsert;
