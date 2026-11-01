import { z } from "zod";
import { webhookEventNames } from "./webhook-events.js";
import { webhookDeliveryStatuses } from "./webhooks.table.js";

const webhookUrlSchema = z
  .string({ error: "Please enter the address to send events to" })
  .trim()
  .max(2000, { error: "Addresses can be at most 2000 characters" })
  .refine(isHttpUrl, {
    error: "The address should start with https:// (or http://), like https://example.com/hooks",
  });

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname !== "";
  } catch {
    return false;
  }
}

const eventListSchema = z
  .array(
    z.enum(webhookEventNames, {
      error: `Events should be from: ${webhookEventNames.join(", ")}`,
    }),
    { error: "Please send a list of events" },
  )
  .min(1, { error: "Choose at least one event to send" })
  .transform((events) => webhookEventNames.filter((name) => events.includes(name)));

const nameSchema = z
  .string({ error: "The name should be text" })
  .trim()
  .max(100, { error: "Names can be at most 100 characters" });

/** `POST /webhooks`. Without a name, the address's host is used. */
export const createWebhookRequestSchema = z.object({
  name: nameSchema.optional(),
  url: webhookUrlSchema,
  events: eventListSchema,
  enabled: z.boolean().default(true),
});

/** `PATCH /webhooks/:id`. Anything left out stays as it is. */
export const updateWebhookRequestSchema = z.object({
  name: nameSchema.optional(),
  url: webhookUrlSchema.optional(),
  events: eventListSchema.optional(),
  enabled: z.boolean({ error: "enabled should be true or false" }).optional(),
});

export const webhookIdParamsSchema = z.object({ id: z.uuid() });
export const webhookDeliveryParamsSchema = z.object({ id: z.uuid(), deliveryId: z.uuid() });

export const listWebhookDeliveriesQuerySchema = z.object({
  page: z.coerce.number({ error: "The page should be a number" }).int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const webhookSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  url: z.string(),
  events: z.array(z.enum(webhookEventNames)),
  enabled: z.boolean(),
  /** For checking the `Lintel-Signature` header; see the webhooks README. */
  secret: z.string(),
  createdAt: z.iso.datetime(),
  /** How the most recent delivery went, if there has been one. */
  lastDelivery: z
    .object({ status: z.enum(webhookDeliveryStatuses), createdAt: z.iso.datetime() })
    .nullable(),
});

export const webhookDeliverySchema = z.object({
  id: z.uuid(),
  event: z.enum(webhookEventNames),
  status: z.enum(webhookDeliveryStatuses),
  attemptCount: z.number().int(),
  nextAttemptAt: z.iso.datetime().nullable(),
  lastAttemptAt: z.iso.datetime().nullable(),
  responseStatus: z.number().int().nullable(),
  responseSummary: z.string().nullable(),
  createdAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export const webhookDeliveryListSchema = z.object({
  deliveries: z.array(webhookDeliverySchema),
  total: z.number().int(),
});

export type CreateWebhookRequest = z.output<typeof createWebhookRequestSchema>;
export type UpdateWebhookRequest = z.output<typeof updateWebhookRequestSchema>;
export type WebhookResponse = z.infer<typeof webhookSchema>;
export type WebhookDeliveryResponse = z.infer<typeof webhookDeliverySchema>;
export type WebhookDeliveryList = z.infer<typeof webhookDeliveryListSchema>;
