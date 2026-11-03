import { randomUUID } from "node:crypto";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  claimDueDelivery,
  findDeliveryRow,
  findDueDeliveryIds,
  insertWebhookDeliveries,
  listDeliveryRows,
  recordDeliveryAttempt,
} from "./webhook-deliveries.repository.js";
import type { WebhookEventName } from "./webhook-events.js";
import { MAX_DELIVERY_ATTEMPTS, nextRetryAt } from "./webhook-retries.js";
import { type SenderOptions, sendWebhookRequest, WebhookSendError } from "./webhook-sender.js";
import { SIGNATURE_HEADER, signWebhookBody } from "./webhook-signatures.js";
import { WebhookDeliveryNotFoundError } from "./webhooks.errors.js";
import { listWebhooksForEvent } from "./webhooks.repository.js";
import type { WebhookDeliveryList, WebhookDeliveryResponse } from "./webhooks.schema.js";
import { findWebhook } from "./webhooks.service.js";
import type { WebhookDeliveryRow, WebhookRow } from "./webhooks.table.js";

/**
 * The delivery log: an event is written down for every webhook that wants it, then sent,
 * and retried on failure. Writing first means a crash or a receiver being down never
 * loses an event; it is sent when the scheduler next looks.
 */

/** How long one attempt may hold a delivery before another server may try it. */
const ATTEMPT_LEASE_MILLISECONDS = 2 * 60_000;
const DELIVERIES_PER_RUN = 25;

/**
 * Writes the event down for each switched-on webhook that asked for it. Returns how many.
 * `text` is an optional one-line summary sent as the payload's `text`, which is what Slack
 * (and similar chat apps' incoming webhooks) show as the message.
 */
export async function queueWebhookEvent(
  database: DatabaseOrTransaction,
  event: WebhookEventName,
  data: Record<string, unknown>,
  now = new Date(),
  text?: string,
): Promise<number> {
  const webhooks = await listWebhooksForEvent(database, DEFAULT_TENANT_ID, event);
  const deliveries = webhooks.map((webhook) => {
    const id = randomUUID();
    return {
      id,
      tenantId: DEFAULT_TENANT_ID,
      webhookId: webhook.id,
      event,
      payload: { id, event, occurredAt: now.toISOString(), ...(text ? { text } : {}), data },
      nextAttemptAt: now,
    };
  });
  await insertWebhookDeliveries(database, deliveries);
  return deliveries.length;
}

export async function listWebhookDeliveries(
  database: DatabaseOrTransaction,
  webhookId: string,
  page: { page: number; perPage: number },
): Promise<WebhookDeliveryList> {
  await findWebhook(database, webhookId);
  const { rows, total } = await listDeliveryRows(database, DEFAULT_TENANT_ID, webhookId, {
    limit: page.perPage,
    offset: (page.page - 1) * page.perPage,
  });
  return { deliveries: rows.map(describeDelivery), total };
}

/**
 * Sends an earlier delivery's event again, as a new delivery with its own id and log
 * line. The data is what it was at the time, not what the content looks like now.
 */
export async function resendWebhookDelivery(
  database: DatabaseOrTransaction,
  webhookId: string,
  deliveryId: string,
  now = new Date(),
): Promise<WebhookDeliveryResponse> {
  const original = await findDeliveryRow(database, DEFAULT_TENANT_ID, webhookId, deliveryId);
  if (!original) {
    throw new WebhookDeliveryNotFoundError();
  }
  const id = randomUUID();
  const [resent] = await insertWebhookDeliveries(database, [
    {
      id,
      tenantId: DEFAULT_TENANT_ID,
      webhookId,
      event: original.event,
      payload: { ...original.payload, id, occurredAt: now.toISOString() },
      nextAttemptAt: now,
    },
  ]);
  if (!resent) {
    throw new Error("Saving the resent delivery returned nothing");
  }
  return describeDelivery(resent);
}

/**
 * Sends every delivery that is due, each claimed first so several servers can run this
 * at once. Run by the scheduler every minute, and straight after an event is queued.
 * Returns the ids it attempted.
 */
export async function deliverDueWebhooks(
  database: DatabaseOrTransaction,
  sender: SenderOptions,
  now = new Date(),
): Promise<string[]> {
  const attempted: string[] = [];
  // Each attempt takes the time it actually starts. One time for the whole run let a slow
  // run's later claims carry a lease already over, so another server could send them too,
  // and signed them minutes old (LINTEL-FUNC-026). `now` still sets where the run starts,
  // for tests and the scheduler.
  const startedAt = Date.now();
  const timeNow = () => new Date(now.getTime() + (Date.now() - startedAt));
  for (const deliveryId of await findDueDeliveryIds(database, now, DELIVERIES_PER_RUN)) {
    const attemptAt = timeNow();
    const leaseUntil = new Date(attemptAt.getTime() + ATTEMPT_LEASE_MILLISECONDS);
    const claimed = await claimDueDelivery(database, deliveryId, attemptAt, leaseUntil);
    if (claimed) {
      await attemptDelivery(database, claimed.delivery, claimed.webhook, sender, attemptAt);
      attempted.push(deliveryId);
    }
  }
  return attempted;
}

async function attemptDelivery(
  database: DatabaseOrTransaction,
  delivery: WebhookDeliveryRow,
  webhook: WebhookRow,
  sender: SenderOptions,
  now: Date,
): Promise<void> {
  const body = JSON.stringify(delivery.payload);
  try {
    const response = await sendWebhookRequest(
      {
        url: webhook.url,
        body,
        headers: {
          "content-type": "application/json",
          "user-agent": "Lintel-Webhooks/1",
          "lintel-event": delivery.event,
          "lintel-delivery": delivery.id,
          [SIGNATURE_HEADER]: signWebhookBody(webhook.secret, body, now),
        },
      },
      sender,
    );
    const succeeded = response.status >= 200 && response.status < 300;
    await recordDeliveryAttempt(database, delivery.id, {
      ...(succeeded ? { status: "delivered", nextAttemptAt: null } : retryOrGiveUp(delivery, now)),
      responseStatus: response.status,
      responseSummary: response.bodyStart || null,
    });
  } catch (error) {
    if (!(error instanceof WebhookSendError)) {
      throw error;
    }
    await recordDeliveryAttempt(database, delivery.id, {
      ...retryOrGiveUp(delivery, now),
      responseStatus: null,
      responseSummary: error.message,
    });
  }
}

function retryOrGiveUp(
  delivery: WebhookDeliveryRow,
  now: Date,
): Pick<WebhookDeliveryRow, "status" | "nextAttemptAt"> {
  const retryAt =
    delivery.attemptCount >= MAX_DELIVERY_ATTEMPTS ? null : nextRetryAt(delivery.attemptCount, now);
  return retryAt
    ? { status: "pending", nextAttemptAt: retryAt }
    : { status: "failed", nextAttemptAt: null };
}

function describeDelivery(row: WebhookDeliveryRow): WebhookDeliveryResponse {
  return {
    id: row.id,
    event: row.event,
    status: row.status,
    attemptCount: row.attemptCount,
    nextAttemptAt: row.status === "pending" ? (row.nextAttemptAt?.toISOString() ?? null) : null,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    responseStatus: row.responseStatus,
    responseSummary: row.responseSummary,
    createdAt: row.createdAt.toISOString(),
    payload: row.payload,
  };
}
