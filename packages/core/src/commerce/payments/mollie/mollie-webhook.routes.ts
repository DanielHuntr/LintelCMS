import type { FastifyInstance } from "fastify";
import type { ShopContext } from "../../commerce.context.js";
import { MOLLIE_WEBHOOK_PATH } from "./mollie-provider.js";
import { handleMollieWebhook } from "./mollie-webhook.service.js";

/**
 * HTTP only:
 *
 *   POST /shop/mollie/webhook   id=tr_… (form-encoded, as Mollie sends it) -> { received: true }
 *
 * No session or permission: the payment is fetched back from Mollie before anything happens.
 */
export async function mollieWebhookRoutes(
  server: FastifyInstance,
  { shop }: { shop: ShopContext },
) {
  server.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => done(null, Object.fromEntries(new URLSearchParams(String(body)))),
  );

  server.post(MOLLIE_WEBHOOK_PATH, async (request) => {
    const body = request.body;
    const id = typeof body === "object" && body !== null ? Reflect.get(body, "id") : undefined;
    return handleMollieWebhook(shop, typeof id === "string" ? id : undefined);
  });
}
