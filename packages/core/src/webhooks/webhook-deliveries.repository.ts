import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type NewWebhookDeliveryRow,
  webhookDeliveriesTable as webhookDeliveriesDefinition,
  type WebhookDeliveryRow,
  type WebhookRow,
  webhooksTable as webhooksDefinition,
} from "./webhooks.table.js";
import { insertReturning, updateReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for the delivery log. */

export async function insertWebhookDeliveries(
  database: DatabaseOrTransaction,
  deliveries: NewWebhookDeliveryRow[],
): Promise<WebhookDeliveryRow[]> {
  const webhookDeliveriesTable = tableFor(database, webhookDeliveriesDefinition);
  if (deliveries.length === 0) {
    return [];
  }
  return insertReturning(database, webhookDeliveriesTable, deliveries);
}

export async function listDeliveryRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  webhookId: string,
  page: { limit: number; offset: number },
): Promise<{ rows: WebhookDeliveryRow[]; total: number }> {
  const webhookDeliveriesTable = tableFor(database, webhookDeliveriesDefinition);
  const where = and(
    eq(webhookDeliveriesTable.tenantId, tenantId),
    eq(webhookDeliveriesTable.webhookId, webhookId),
  );
  const rows = await database
    .select()
    .from(webhookDeliveriesTable)
    .where(where)
    .orderBy(desc(webhookDeliveriesTable.createdAt), desc(webhookDeliveriesTable.id))
    .limit(page.limit)
    .offset(page.offset);
  const [count] = await database
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(webhookDeliveriesTable)
    .where(where);
  return { rows, total: count?.total ?? 0 };
}

export async function findDeliveryRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  webhookId: string,
  deliveryId: string,
): Promise<WebhookDeliveryRow | undefined> {
  const webhookDeliveriesTable = tableFor(database, webhookDeliveriesDefinition);
  const [delivery] = await database
    .select()
    .from(webhookDeliveriesTable)
    .where(
      and(
        eq(webhookDeliveriesTable.tenantId, tenantId),
        eq(webhookDeliveriesTable.webhookId, webhookId),
        eq(webhookDeliveriesTable.id, deliveryId),
      ),
    )
    .limit(1);
  return delivery;
}

export async function findDueDeliveryIds(
  database: DatabaseOrTransaction,
  now: Date,
  limit: number,
): Promise<string[]> {
  const webhookDeliveriesTable = tableFor(database, webhookDeliveriesDefinition);
  const rows = await database
    .select({ id: webhookDeliveriesTable.id })
    .from(webhookDeliveriesTable)
    .where(
      and(
        eq(webhookDeliveriesTable.status, "pending"),
        lte(webhookDeliveriesTable.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(webhookDeliveriesTable.nextAttemptAt))
    .limit(limit);
  return rows.map((row) => row.id);
}

/**
 * Claims a due delivery for one attempt by pushing its next attempt out to `leaseUntil`,
 * in a single update. Only one server's claim succeeds; if that server dies mid-send, the
 * lease runs out and another tries again. Returns the delivery with its webhook.
 */
export async function claimDueDelivery(
  database: DatabaseOrTransaction,
  deliveryId: string,
  now: Date,
  leaseUntil: Date,
): Promise<{ delivery: WebhookDeliveryRow; webhook: WebhookRow } | undefined> {
  const webhookDeliveriesTable = tableFor(database, webhookDeliveriesDefinition);
  const webhooksTable = tableFor(database, webhooksDefinition);
  const [delivery] = await updateReturning(
    database,
    webhookDeliveriesTable,
    {
      nextAttemptAt: leaseUntil,
      attemptCount: sql`${webhookDeliveriesTable.attemptCount} + 1`,
      lastAttemptAt: now,
    },
    and(
      eq(webhookDeliveriesTable.id, deliveryId),
      eq(webhookDeliveriesTable.status, "pending"),
      lte(webhookDeliveriesTable.nextAttemptAt, now),
    ),
  );
  if (!delivery) {
    return undefined;
  }
  const [webhook] = await database
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.id, delivery.webhookId))
    .limit(1);
  return webhook ? { delivery, webhook } : undefined;
}

export async function recordDeliveryAttempt(
  database: DatabaseOrTransaction,
  deliveryId: string,
  outcome: Pick<
    WebhookDeliveryRow,
    "status" | "nextAttemptAt" | "responseStatus" | "responseSummary"
  >,
): Promise<void> {
  const webhookDeliveriesTable = tableFor(database, webhookDeliveriesDefinition);
  await database
    .update(webhookDeliveriesTable)
    .set(outcome)
    .where(eq(webhookDeliveriesTable.id, deliveryId));
}
