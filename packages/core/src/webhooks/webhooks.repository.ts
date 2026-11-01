import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type NewWebhookRow,
  webhookDeliveriesTable,
  type WebhookDeliveryStatus,
  type WebhookRow,
  webhooksTable,
} from "./webhooks.table.js";

/** Database reads and writes for webhooks themselves. Deliveries are in their own file. */

export type WebhookWithLastDelivery = WebhookRow & {
  lastDelivery: { status: WebhookDeliveryStatus; createdAt: Date } | null;
};

export async function listWebhookRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<WebhookWithLastDelivery[]> {
  const webhooks = await database
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.tenantId, tenantId))
    .orderBy(webhooksTable.createdAt);
  return attachLastDeliveries(database, webhooks);
}

export async function findWebhookRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  webhookId: string,
): Promise<WebhookWithLastDelivery | undefined> {
  const [webhook] = await database
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.tenantId, tenantId), eq(webhooksTable.id, webhookId)))
    .limit(1);
  if (!webhook) {
    return undefined;
  }
  const [withDelivery] = await attachLastDeliveries(database, [webhook]);
  return withDelivery;
}

/** Switched-on webhooks that asked for this event. */
export async function listWebhooksForEvent(
  database: DatabaseOrTransaction,
  tenantId: string,
  event: string,
): Promise<WebhookRow[]> {
  return database
    .select()
    .from(webhooksTable)
    .where(
      and(
        eq(webhooksTable.tenantId, tenantId),
        eq(webhooksTable.enabled, true),
        sql`${webhooksTable.events} @> ${JSON.stringify([event])}::jsonb`,
      ),
    );
}

export async function insertWebhook(
  database: DatabaseOrTransaction,
  webhook: NewWebhookRow,
): Promise<WebhookRow> {
  const [inserted] = await database.insert(webhooksTable).values(webhook).returning();
  if (!inserted) {
    throw new Error("Saving the webhook returned nothing");
  }
  return inserted;
}

export async function updateWebhookRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  webhookId: string,
  changes: Partial<Pick<WebhookRow, "name" | "url" | "events" | "enabled">>,
): Promise<void> {
  await database
    .update(webhooksTable)
    .set(changes)
    .where(and(eq(webhooksTable.tenantId, tenantId), eq(webhooksTable.id, webhookId)));
}

/** True when a webhook was deleted. Its deliveries go with it. */
export async function deleteWebhookRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  webhookId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(webhooksTable)
    .where(and(eq(webhooksTable.tenantId, tenantId), eq(webhooksTable.id, webhookId)))
    .returning({ id: webhooksTable.id });
  return deleted.length > 0;
}

async function attachLastDeliveries(
  database: DatabaseOrTransaction,
  webhooks: WebhookRow[],
): Promise<WebhookWithLastDelivery[]> {
  if (webhooks.length === 0) {
    return [];
  }
  const latest = await database
    .selectDistinctOn([webhookDeliveriesTable.webhookId], {
      webhookId: webhookDeliveriesTable.webhookId,
      status: webhookDeliveriesTable.status,
      createdAt: webhookDeliveriesTable.createdAt,
    })
    .from(webhookDeliveriesTable)
    .where(
      inArray(
        webhookDeliveriesTable.webhookId,
        webhooks.map((webhook) => webhook.id),
      ),
    )
    .orderBy(webhookDeliveriesTable.webhookId, desc(webhookDeliveriesTable.createdAt));
  const byWebhook = new Map(latest.map((row) => [row.webhookId, row]));
  return webhooks.map((webhook) => {
    const last = byWebhook.get(webhook.id);
    return {
      ...webhook,
      lastDelivery: last ? { status: last.status, createdAt: last.createdAt } : null,
    };
  });
}
