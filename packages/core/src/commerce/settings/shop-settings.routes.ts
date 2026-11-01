import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import type { ShopContext } from "../commerce.context.js";
import { updatePaymentSettingsRequestSchema } from "../payments/payment-settings.schema.js";
import {
  checkStripeConnection,
  disconnectStripe,
  readPaymentSettings,
  updatePaymentSettings,
} from "../payments/payment-settings.service.js";
import { updateTaxSettingsRequestSchema } from "../taxes/taxes.schema.js";
import { readTaxSettings, updateTaxSettings } from "../taxes/taxes.service.js";
import { updateShopSettingsRequestSchema } from "./shop-settings.schema.js";
import { readShopSettings, updateShopSettings } from "./shop-settings.service.js";

/**
 * HTTP only. Markets, shipping and locations have their own routes; these are the rest of
 * Shop → Settings. Payment keys are settings:update as well as commerce:update, because a
 * secret key can move money.
 *
 *   GET    /shop/settings                    (commerce:read)    -> { shopName, supportEmail, ... }
 *   PATCH  /shop/settings                    (commerce:update)
 *   GET    /shop/settings/taxes              (commerce:read)
 *   PATCH  /shop/settings/taxes              (commerce:update)  { taxCalculation?, taxShipping?, manualTaxRates? }
 *   GET    /shop/settings/payments           (commerce:read)    keys shown only as hints
 *   PUT    /shop/settings/payments           (settings:update)  { secretKey?, publishableKey?, webhookSecret?, checkoutMode? }
 *   DELETE /shop/settings/payments           (settings:update)  forgets the keys saved here
 *   POST   /shop/settings/payments/check     (commerce:read)    -> { accountId, accountName, mode }
 */
export async function shopSettingsRoutes(server: FastifyInstance, { shop }: { shop: ShopContext }) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };
  const updateKeys = {
    preHandler: [requirePermission("commerce:update"), requirePermission("settings:update")],
  };

  server.get("/shop/settings", read, async () => readShopSettings(server.database));

  server.patch("/shop/settings", update, async (request) => {
    const changes = parseRequest(updateShopSettingsRequestSchema, request.body);
    return updateShopSettings(server.database, changes);
  });

  server.get("/shop/settings/taxes", read, async () => readTaxSettings(shop));

  server.patch("/shop/settings/taxes", update, async (request) => {
    const changes = parseRequest(updateTaxSettingsRequestSchema, request.body);
    return updateTaxSettings(shop, changes);
  });

  server.get("/shop/settings/payments", read, async () => readPaymentSettings(shop));

  server.put("/shop/settings/payments", updateKeys, async (request) => {
    const changes = parseRequest(updatePaymentSettingsRequestSchema, request.body);
    return updatePaymentSettings(shop, changes);
  });

  server.delete("/shop/settings/payments", updateKeys, async () => disconnectStripe(shop));

  server.post("/shop/settings/payments/check", read, async () => checkStripeConnection(shop));
}
