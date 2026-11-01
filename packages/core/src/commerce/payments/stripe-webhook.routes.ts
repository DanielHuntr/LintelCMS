import type { FastifyInstance } from "fastify";
import type { ShopContext } from "../commerce.context.js";
import { STRIPE_WEBHOOK_PATH } from "./payment-settings.service.js";
import { handleStripeWebhook } from "./stripe-webhook.service.js";

/**
 * HTTP only:
 *
 *   POST /shop/stripe/webhook   Stripe-Signature header required -> { received: true }
 *
 * The signature covers the exact bytes Stripe sent, so in this plugin (and only here) JSON
 * bodies are kept as text instead of being parsed. No session or permission: the signature
 * is the proof.
 */
export async function stripeWebhookRoutes(
  server: FastifyInstance,
  { shop }: { shop: ShopContext },
) {
  server.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) =>
    done(null, body),
  );

  server.post(STRIPE_WEBHOOK_PATH, async (request) => {
    const signature = request.headers["stripe-signature"];
    return handleStripeWebhook(
      shop,
      typeof request.body === "string" ? request.body : "",
      typeof signature === "string" ? signature : undefined,
    );
  });
}
