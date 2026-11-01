import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ShopContext } from "../../commerce.context.js";
import { handlePayPalWebhook, PAYPAL_WEBHOOK_PATH } from "./paypal-webhook.service.js";

/**
 * HTTP only:
 *
 *   POST /shop/paypal/webhook   PayPal-Transmission-* headers required -> { received: true }
 *
 * No session or permission: PayPal's own confirmation of the transmission is the proof.
 */
export async function payPalWebhookRoutes(
  server: FastifyInstance,
  { shop }: { shop: ShopContext },
) {
  server.post(PAYPAL_WEBHOOK_PATH, async (request) =>
    handlePayPalWebhook(shop, request.body, {
      authAlgo: header(request, "paypal-auth-algo"),
      certUrl: header(request, "paypal-cert-url"),
      transmissionId: header(request, "paypal-transmission-id"),
      transmissionSig: header(request, "paypal-transmission-sig"),
      transmissionTime: header(request, "paypal-transmission-time"),
    }),
  );
}

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}
