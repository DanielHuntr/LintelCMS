import { definePlugin } from "../plugins/plugin-definition.js";
import { cartsRoutes } from "./carts/carts.routes.js";
import { customersRoutes } from "./customers/customers.routes.js";
import { discountsRoutes } from "./discounts/discounts.routes.js";
import { inventoryRoutes } from "./inventory/inventory.routes.js";
import { marketsRoutes } from "./markets/markets.routes.js";
import { ordersRoutes } from "./orders/orders.routes.js";
import { mollieWebhookRoutes } from "./payments/mollie/mollie-webhook.routes.js";
import { paymentProvidersRoutes } from "./payments/payment-providers.routes.js";
import { payPalWebhookRoutes } from "./payments/paypal/paypal-webhook.routes.js";
import { stripeWebhookRoutes } from "./payments/stripe-webhook.routes.js";
import { productCollectionsRoutes } from "./product-collections/product-collections.routes.js";
import { productsRoutes } from "./products/products.routes.js";
import { salesRoutes } from "./sales/sales.routes.js";
import { shopSettingsRoutes } from "./settings/shop-settings.routes.js";
import { shippingRoutes } from "./shipping/shipping.routes.js";
import { shopifyImportRoutes } from "./shopify-import/shopify-import.routes.js";
import { storefrontRoutes } from "./storefront/storefront.routes.js";

/**
 * The online shop. Its routes answer only while it is switched on (404 PLUGIN_NOT_ENABLED
 * otherwise): admin routes under /shop, the storefront's under /delivery/shop, and the
 * payment services' webhooks under /shop/<provider>/webhook. What they share, the order
 * events and the stock job are set up by `registerCommerce`.
 *
 * Its tables (`shop_*`) are in Lintel's own migrations, so the definition has no `database`.
 */
export const commercePlugin = definePlugin({
  id: "commerce",
  name: "Online shop",
  description: "Products, orders and payments.",
  permissions: [
    {
      permission: "commerce:read",
      name: "See the shop",
      description: "Products, orders and customers.",
    },
    {
      permission: "commerce:update",
      name: "Run the shop",
      description: "Change products and prices, and handle orders.",
    },
    {
      permission: "commerce:refund",
      name: "Refund orders",
      description: "Give money back to customers.",
    },
  ],
  async routes(server) {
    const withShop = { shop: server.shop };
    await server.register(shopSettingsRoutes, withShop);
    await server.register(marketsRoutes);
    await server.register(inventoryRoutes);
    await server.register(shippingRoutes);
    await server.register(productsRoutes, withShop);
    await server.register(productCollectionsRoutes);
    await server.register(ordersRoutes, withShop);
    await server.register(customersRoutes);
    await server.register(discountsRoutes, withShop);
    await server.register(salesRoutes, withShop);
    await server.register(shopifyImportRoutes, withShop);
    await server.register(storefrontRoutes, withShop);
    await server.register(cartsRoutes, withShop);
    await server.register(stripeWebhookRoutes, withShop);
    await server.register(paymentProvidersRoutes, withShop);
    await server.register(payPalWebhookRoutes, withShop);
    await server.register(mollieWebhookRoutes, withShop);
  },
});
