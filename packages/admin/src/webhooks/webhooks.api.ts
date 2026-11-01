import { apiRequest } from "../api/client.js";
import type { StringKey } from "../i18n/strings.js";

/** Calls to the API's webhook routes (see packages/core/src/webhooks). */

export const webhookEvents = [
  "entry.published",
  "entry.unpublished",
  "entry.deleted",
  "asset.uploaded",
  "asset.deleted",
] as const;

export type WebhookEvent = (typeof webhookEvents)[number];

/** What each event is called in the admin. */
export const webhookEventLabels: Record<WebhookEvent, StringKey> = {
  "entry.published": "webhooks.event.entryPublished",
  "entry.unpublished": "webhooks.event.entryUnpublished",
  "entry.deleted": "webhooks.event.entryDeleted",
  "asset.uploaded": "webhooks.event.assetUploaded",
  "asset.deleted": "webhooks.event.assetDeleted",
};

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  secret: string;
  createdAt: string;
  lastDelivery: { status: DeliveryStatus; createdAt: string } | null;
}

export interface WebhookDelivery {
  id: string;
  event: WebhookEvent;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  responseStatus: number | null;
  responseSummary: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface WebhookChanges {
  name?: string;
  url?: string;
  events?: WebhookEvent[];
  enabled?: boolean;
}

export async function listWebhooks(): Promise<Webhook[]> {
  const { webhooks } = await apiRequest<{ webhooks: Webhook[] }>("/webhooks");
  return webhooks;
}

export function getWebhook(webhookId: string) {
  return apiRequest<Webhook>(`/webhooks/${encodeURIComponent(webhookId)}`);
}

export function createWebhook(webhook: { name: string; url: string; events: WebhookEvent[] }) {
  return apiRequest<Webhook>("/webhooks", { method: "POST", body: webhook });
}

export function updateWebhook(webhookId: string, changes: WebhookChanges) {
  return apiRequest<Webhook>(`/webhooks/${encodeURIComponent(webhookId)}`, {
    method: "PATCH",
    body: changes,
  });
}

export function deleteWebhook(webhookId: string) {
  return apiRequest<void>(`/webhooks/${encodeURIComponent(webhookId)}`, { method: "DELETE" });
}

export function listWebhookDeliveries(webhookId: string) {
  return apiRequest<{ deliveries: WebhookDelivery[]; total: number }>(
    `/webhooks/${encodeURIComponent(webhookId)}/deliveries?perPage=50`,
  );
}

export function resendWebhookDelivery(webhookId: string, deliveryId: string) {
  return apiRequest<WebhookDelivery>(
    `/webhooks/${encodeURIComponent(webhookId)}/deliveries/${encodeURIComponent(deliveryId)}/resend`,
    { method: "POST" },
  );
}
