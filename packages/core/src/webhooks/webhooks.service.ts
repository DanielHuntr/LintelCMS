import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { checkWebhookAddress, type SenderOptions, WebhookSendError } from "./webhook-sender.js";
import { generateWebhookSecret } from "./webhook-signatures.js";
import { PrivateWebhookAddressError, WebhookNotFoundError } from "./webhooks.errors.js";
import {
  deleteWebhookRow,
  findWebhookRow,
  insertWebhook,
  listWebhookRows,
  updateWebhookRow,
  type WebhookWithLastDelivery,
} from "./webhooks.repository.js";
import type {
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookResponse,
} from "./webhooks.schema.js";

/** Adding, changing and removing webhooks. Sending is in webhook-deliveries.service.ts. */

export async function listWebhooks(
  database: DatabaseOrTransaction,
): Promise<{ webhooks: WebhookResponse[] }> {
  const rows = await listWebhookRows(database, DEFAULT_TENANT_ID);
  return { webhooks: rows.map(describeWebhook) };
}

export async function findWebhook(
  database: DatabaseOrTransaction,
  webhookId: string,
): Promise<WebhookResponse> {
  const row = await findWebhookRow(database, DEFAULT_TENANT_ID, webhookId);
  if (!row) {
    throw new WebhookNotFoundError();
  }
  return describeWebhook(row);
}

export async function createWebhook(
  database: DatabaseOrTransaction,
  request: CreateWebhookRequest,
  createdBy: string,
  sender: SenderOptions,
): Promise<WebhookResponse> {
  const url = refuseUnsafeAddress(request.url, sender);
  const webhook = await insertWebhook(database, {
    tenantId: DEFAULT_TENANT_ID,
    name: request.name || url.host,
    url: url.href,
    events: request.events,
    enabled: request.enabled,
    secret: generateWebhookSecret(),
    createdBy,
  });
  return findWebhook(database, webhook.id);
}

export async function updateWebhook(
  database: DatabaseOrTransaction,
  webhookId: string,
  request: UpdateWebhookRequest,
  sender: SenderOptions,
): Promise<WebhookResponse> {
  const existing = await findWebhook(database, webhookId);
  const url = request.url === undefined ? undefined : refuseUnsafeAddress(request.url, sender);
  const changes = {
    ...(request.name !== undefined && { name: request.name || new URL(existing.url).host }),
    ...(url && { url: url.href }),
    ...(request.events && { events: request.events }),
    ...(request.enabled !== undefined && { enabled: request.enabled }),
  };
  if (Object.keys(changes).length > 0) {
    await updateWebhookRow(database, DEFAULT_TENANT_ID, webhookId, changes);
  }
  return findWebhook(database, webhookId);
}

export async function deleteWebhook(
  database: DatabaseOrTransaction,
  webhookId: string,
): Promise<void> {
  if (!(await deleteWebhookRow(database, DEFAULT_TENANT_ID, webhookId))) {
    throw new WebhookNotFoundError();
  }
}

/**
 * Addresses that are obviously private (localhost, 10.0.0.5) are refused when saving, so
 * the admin hears about it straight away. Names are checked again on every send.
 */
function refuseUnsafeAddress(address: string, sender: SenderOptions): URL {
  const url = new URL(address);
  try {
    checkWebhookAddress(url, sender);
  } catch (error) {
    if (error instanceof WebhookSendError) {
      throw new PrivateWebhookAddressError(url.hostname);
    }
    throw error;
  }
  return url;
}

function describeWebhook(row: WebhookWithLastDelivery): WebhookResponse {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: row.events,
    enabled: row.enabled,
    secret: row.secret,
    createdAt: row.createdAt.toISOString(),
    lastDelivery: row.lastDelivery
      ? { status: row.lastDelivery.status, createdAt: row.lastDelivery.createdAt.toISOString() }
      : null,
  };
}
