import type { FastifyInstance, FastifyRequest } from "fastify";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { type RepeatingJob, startRepeatingJob } from "../scheduler/repeating-job.js";
import { cartsRoutes } from "./carts/carts.routes.js";
import { expireAbandonedCheckouts } from "./checkouts/checkout-expiry.js";
import { type CommerceOptions, createShopContext } from "./commerce.context.js";
import { CommercePluginDisabledError } from "./commerce.errors.js";
import { customersRoutes } from "./customers/customers.routes.js";
import { emailsRoutes } from "./emails/emails.routes.js";
import { inventoryRoutes } from "./inventory/inventory.routes.js";
import { marketsRoutes } from "./markets/markets.routes.js";
import { ordersRoutes } from "./orders/orders.routes.js";
import { stripeWebhookRoutes } from "./payments/stripe-webhook.routes.js";
import { productCollectionsRoutes } from "./product-collections/product-collections.routes.js";
import { productsRoutes } from "./products/products.routes.js";
import { salesRoutes } from "./sales/sales.routes.js";
import { shopSettingsRoutes } from "./settings/shop-settings.routes.js";
import { shippingRoutes } from "./shipping/shipping.routes.js";
import { storefrontRoutes } from "./storefront/storefront.routes.js";

const ONE_MINUTE = 60_000;

/** Whether the "Online shop" plugin is switched on (see src/plugins). */
export async function isCommercePluginEnabled(request: FastifyRequest): Promise<boolean> {
  return (await findEnabledPluginIds(request.server.database)).includes("commerce");
}

/**
 * The whole shop, registered with one `server.register(commercePlugin)` in server.ts. Every
 * route inside answers 404 PLUGIN_NOT_ENABLED while the plugin is off; the hook is added in
 * this plugin's own scope, so it touches no route outside the shop.
 *
 * Admin routes are under /shop, the storefront's under /delivery/shop, and Stripe's webhook
 * at /shop/stripe/webhook.
 */
export async function commercePlugin(server: FastifyInstance, options: CommerceOptions) {
  const shop = createShopContext(server, options);

  server.addHook("onRequest", async (request) => {
    if (!(await isCommercePluginEnabled(request))) {
      throw new CommercePluginDisabledError();
    }
  });

  const withShop = { shop };
  server.register(shopSettingsRoutes, withShop);
  server.register(marketsRoutes);
  server.register(inventoryRoutes);
  server.register(shippingRoutes);
  server.register(productsRoutes, withShop);
  server.register(productCollectionsRoutes);
  server.register(ordersRoutes, withShop);
  server.register(customersRoutes);
  server.register(emailsRoutes, withShop);
  server.register(salesRoutes, withShop);
  server.register(storefrontRoutes, withShop);
  server.register(cartsRoutes, withShop);
  server.register(stripeWebhookRoutes, withShop);

  if (options.runScheduledJobs ?? true) {
    let job: RepeatingJob | undefined;
    server.addHook("onReady", async () => {
      job = startRepeatingJob({
        everyMilliseconds: ONE_MINUTE,
        run: async () => {
          await expireAbandonedCheckouts(shop);
        },
        onError: (error) =>
          server.log.error(error, "Releasing stock from abandoned checkouts failed"),
      });
    });
    server.addHook("onClose", async () => job?.stop());
  }
}
