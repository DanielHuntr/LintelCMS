import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { appsTable as appsDefinition } from "../apps/apps.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import {
  type NewWebhookRow,
  webhookDeliveriesTable as webhookDeliveriesDefinition,
  type WebhookDeliveryStatus,
  type WebhookRow,
  webhooksTable as webhooksDefinition,
} from "./webhooks.table.js";
import { deleteReturning, insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { jsonListIncludes } from "../database/dialect/expressions.js";
import { selectNewestPerGroup } from "../database/dialect/reads.js";

/** Database reads and writes for webhooks themselves. Deliveries are in their own file. */

/**
 * Webhooks people added in Settings. Apps' subscriptions (`appId` set) are left out of
 * listing, changing and deleting: they belong to the app, are shown with it, and are
 * removed by uninstalling it. They are still sent, by `listWebhooksForEvent`.
 */
function addedInSettings(webhooksTable: typeof webhooksDefinition, tenantId: string) {
  return and(eq(webhooksTable.tenantId, tenantId), isNull(webhooksTable.appId));
}

export type WebhookWithLastDelivery = WebhookRow & {
  lastDelivery: { status: WebhookDeliveryStatus; createdAt: Date } | null;
};

export async function listWebhookRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<WebhookWithLastDelivery[]> {
  const webhooksTable = tableFor(database, webhooksDefinition);
  const webhooks = await database
    .select()
    .from(webhooksTable)
    .where(addedInSettings(webhooksTable, tenantId))
    .orderBy(webhooksTable.createdAt);
  return attachLastDeliveries(database, webhooks);
}

export async function findWebhookRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  webhookId: string,
): Promise<WebhookWithLastDelivery | undefined> {
  const webhooksTable = tableFor(database, webhooksDefinition);
  const [webhook] = await database
    .select()
    .from(webhooksTable)
    .where(and(addedInSettings(webhooksTable, tenantId), eq(webhooksTable.id, webhookId)))
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
  const appsTable = tableFor(database, appsDefinition);
  const usersTable = tableFor(database, usersDefinition);
  const webhooksTable = tableFor(database, webhooksDefinition);
  return database
    .select()
    .from(webhooksTable)
    .where(
      and(
        eq(webhooksTable.tenantId, tenantId),
        eq(webhooksTable.enabled, true),
        jsonListIncludes(database, webhooksTable.events, event),
        // An app stops working with its installer's account; so does telling it things.
        sql`(${webhooksTable.appId} is null or exists (
          select 1 from ${appsTable} inner join ${usersTable}
            on ${usersTable.id} = ${appsTable.installedBy}
          where ${appsTable.id} = ${webhooksTable.appId} and ${usersTable.status} = 'active'
        ))`,
      ),
    );
}

export async function insertWebhook(
  database: DatabaseOrTransaction,
  webhook: NewWebhookRow,
): Promise<WebhookRow> {
  const webhooksTable = tableFor(database, webhooksDefinition);
  const [inserted] = await insertReturning(database, webhooksTable, webhook);
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
  const webhooksTable = tableFor(database, webhooksDefinition);
  await database
    .update(webhooksTable)
    .set(changes)
    .where(and(addedInSettings(webhooksTable, tenantId), eq(webhooksTable.id, webhookId)));
}

/** True when a webhook was deleted. Its deliveries go with it. */
export async function deleteWebhookRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  webhookId: string,
): Promise<boolean> {
  const webhooksTable = tableFor(database, webhooksDefinition);
  const deleted = await deleteReturning(
    database,
    webhooksTable,
    and(addedInSettings(webhooksTable, tenantId), eq(webhooksTable.id, webhookId)),
    { id: webhooksTable.id },
  );
  return deleted.length > 0;
}

async function attachLastDeliveries(
  database: DatabaseOrTransaction,
  webhooks: WebhookRow[],
): Promise<WebhookWithLastDelivery[]> {
  const webhookDeliveriesTable = tableFor(database, webhookDeliveriesDefinition);
  if (webhooks.length === 0) {
    return [];
  }
  const latest = await selectNewestPerGroup(database, webhookDeliveriesTable, {
    fields: {
      webhookId: webhookDeliveriesTable.webhookId,
      status: webhookDeliveriesTable.status,
      createdAt: webhookDeliveriesTable.createdAt,
    },
    groupBy: webhookDeliveriesTable.webhookId,
    newest: webhookDeliveriesTable.createdAt,
    where: inArray(
      webhookDeliveriesTable.webhookId,
      webhooks.map((webhook) => webhook.id),
    ),
  });
  const byWebhook = new Map(latest.map((row) => [row.webhookId, row]));
  return webhooks.map((webhook) => {
    const last = byWebhook.get(webhook.id);
    return {
      ...webhook,
      lastDelivery: last ? { status: last.status, createdAt: last.createdAt } : null,
    };
  });
}
