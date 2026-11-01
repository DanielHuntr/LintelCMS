import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { listWebhookDeliveries, resendWebhookDelivery } from "./webhook-deliveries.service.js";
import { WebhookDeliveryNotFoundError, WebhookNotFoundError } from "./webhooks.errors.js";
import {
  createWebhookRequestSchema,
  listWebhookDeliveriesQuerySchema,
  updateWebhookRequestSchema,
  webhookDeliveryParamsSchema,
  webhookIdParamsSchema,
} from "./webhooks.schema.js";
import {
  createWebhook,
  deleteWebhook,
  findWebhook,
  listWebhooks,
  updateWebhook,
} from "./webhooks.service.js";

/**
 * HTTP only. Webhooks are site settings, so they need the settings permissions:
 *
 *   GET    /webhooks                                     (settings:read)
 *   POST   /webhooks                                     (settings:update)  { name?, url, events, enabled? } -> 201
 *   GET    /webhooks/:id                                 (settings:read)
 *   PATCH  /webhooks/:id                                 (settings:update)  { name?, url?, events?, enabled? }
 *   DELETE /webhooks/:id                                 (settings:update)  -> 204
 *   GET    /webhooks/:id/deliveries                      (settings:read)    ?page&perPage
 *   POST   /webhooks/:id/deliveries/:deliveryId/resend   (settings:update)  -> 202 the new delivery
 */
export async function webhooksRoutes(server: FastifyInstance) {
  const read = { preHandler: requirePermission("settings:read") };
  const update = { preHandler: requirePermission("settings:update") };

  server.get("/webhooks", read, async () => listWebhooks(server.database));

  server.post("/webhooks", update, async (request, reply) => {
    const webhook = parseRequest(createWebhookRequestSchema, request.body);
    const created = await createWebhook(
      server.database,
      webhook,
      getSignedIn(request).user.id,
      server.webhooks.sender,
    );
    return reply.code(201).send(created);
  });

  server.get("/webhooks/:id", read, async (request) =>
    findWebhook(server.database, readWebhookId(request.params)),
  );

  server.patch("/webhooks/:id", update, async (request) => {
    const changes = parseRequest(updateWebhookRequestSchema, request.body);
    return updateWebhook(
      server.database,
      readWebhookId(request.params),
      changes,
      server.webhooks.sender,
    );
  });

  server.delete("/webhooks/:id", update, async (request, reply) => {
    await deleteWebhook(server.database, readWebhookId(request.params));
    return reply.code(204).send();
  });

  server.get("/webhooks/:id/deliveries", read, async (request) => {
    const page = parseRequest(listWebhookDeliveriesQuerySchema, request.query);
    return listWebhookDeliveries(server.database, readWebhookId(request.params), page);
  });

  server.post("/webhooks/:id/deliveries/:deliveryId/resend", update, async (request, reply) => {
    const parsed = webhookDeliveryParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new WebhookDeliveryNotFoundError();
    }
    const resent = await resendWebhookDelivery(
      server.database,
      parsed.data.id,
      parsed.data.deliveryId,
    );
    server.webhooks.deliverSoon();
    return reply.code(202).send(resent);
  });
}

function readWebhookId(params: unknown): string {
  const parsed = webhookIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new WebhookNotFoundError();
  }
  return parsed.data.id;
}
