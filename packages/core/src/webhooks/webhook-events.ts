/**
 * Everything a webhook can be told about, in one visible list. Each name is
 * "<thing>.<what happened>", as it appears in the `Lintel-Event` header and the payload.
 */
export const webhookEventNames = [
  "entry.published",
  "entry.unpublished",
  "entry.deleted",
  "asset.uploaded",
  "asset.deleted",
  "form.submitted",
] as const;

export type WebhookEventName = (typeof webhookEventNames)[number];

export function isWebhookEventName(name: string): name is WebhookEventName {
  return (webhookEventNames as readonly string[]).includes(name);
}
