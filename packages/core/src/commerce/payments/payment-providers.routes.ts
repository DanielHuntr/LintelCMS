import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import type { ShopContext } from "../commerce.context.js";
import {
  connectMollieRequestSchema,
  connectPayPalRequestSchema,
} from "./payment-providers.schema.js";
import {
  saveMollieConnection,
  savePayPalConnection,
  disconnectProvider,
  readPaymentProviders,
} from "./payment-providers.service.js";
import { readWaysToPay } from "./ways-to-pay.service.js";

/**
 * HTTP only. PayPal and Mollie in Shop → Settings → Payments (Stripe's steps are in
 * settings/shop-settings.routes.ts). Saving keys needs settings:update as well, because
 * keys can move money. Which market uses which is set on the market (PATCH /shop/markets/:id).
 *
 *   GET    /shop/settings/payment-providers          (commerce:read)
 *   GET    /shop/settings/ways-to-pay                (commerce:read)
 *   PUT    /shop/settings/payment-providers/paypal   (settings:update)  { clientId, clientSecret, webhookId?, environment }
 *   DELETE /shop/settings/payment-providers/paypal   (settings:update)
 *   PUT    /shop/settings/payment-providers/mollie   (settings:update)  { apiKey }
 *   DELETE /shop/settings/payment-providers/mollie   (settings:update)
 */
export async function paymentProvidersRoutes(
  server: FastifyInstance,
  { shop }: { shop: ShopContext },
) {
  const read = { preHandler: requirePermission("commerce:read") };
  const updateKeys = {
    preHandler: [requirePermission("commerce:update"), requirePermission("settings:update")],
  };

  server.get("/shop/settings/payment-providers", read, async () => readPaymentProviders(shop));
  server.get("/shop/settings/ways-to-pay", read, async () => readWaysToPay(shop));

  server.put("/shop/settings/payment-providers/paypal", updateKeys, async (request) =>
    savePayPalConnection(shop, parseRequest(connectPayPalRequestSchema, request.body)),
  );
  server.delete("/shop/settings/payment-providers/paypal", updateKeys, async () =>
    disconnectProvider(shop, "paypal"),
  );

  server.put("/shop/settings/payment-providers/mollie", updateKeys, async (request) =>
    saveMollieConnection(shop, parseRequest(connectMollieRequestSchema, request.body)),
  );
  server.delete("/shop/settings/payment-providers/mollie", updateKeys, async () =>
    disconnectProvider(shop, "mollie"),
  );
}
