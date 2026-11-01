/**
 * Every table the shop owns, in one list. `src/database/schema.ts` re-exports this file, so
 * the whole shop reaches Drizzle and its migrations through a single line.
 */
export { cartLinesTable, cartsTable } from "./carts/carts.table.js";
export { checkoutsTable } from "./checkouts/checkouts.table.js";
export { customersTable } from "./customers/customers.table.js";
export { discountRedemptionsTable, discountsTable } from "./discounts/discounts.table.js";
export {
  inventoryLevelsTable,
  inventoryLocationsTable,
  inventoryReservationsTable,
} from "./inventory/inventory.table.js";
export { marketsTable } from "./markets/markets.table.js";
export {
  fulfilmentsTable,
  orderEventsTable,
  orderLinesTable,
  ordersTable,
  refundsTable,
} from "./orders/orders.table.js";
export { paymentAccountsTable, paymentEventsTable } from "./payments/payment-accounts.table.js";
export { stripeEventsTable } from "./payments/stripe-events.table.js";
export {
  productCollectionItemsTable,
  productCollectionsTable,
} from "./product-collections/product-collections.table.js";
export { productsTable, variantPricesTable, variantsTable } from "./products/products.table.js";
export { shopSettingsTable } from "./settings/shop-settings.table.js";
export { shippingRatesTable, shippingZonesTable } from "./shipping/shipping.table.js";
export { archivedOrdersTable, shopifyImportsTable } from "./shopify-import/shopify-import.table.js";
