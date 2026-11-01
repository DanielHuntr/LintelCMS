import { type AnyRoute, createRoute, useParams } from "@tanstack/react-router";
import { CustomerDetailPage } from "./CustomerDetailPage.js";
import { CustomersPage } from "./CustomersPage.js";
import { DiscountEditorPage } from "./DiscountEditorPage.js";
import { DiscountsPage } from "./DiscountsPage.js";
import { MarketsPage } from "./MarketsPage.js";
import { OrderDetailPage } from "./OrderDetailPage.js";
import { OrdersPage } from "./OrdersPage.js";
import { PaymentsPage } from "./PaymentsPage.js";
import { ProductEditorPage } from "./ProductEditorPage.js";
import { ProductsPage } from "./ProductsPage.js";
import { ShippingPage } from "./ShippingPage.js";
import { ShopHomePage } from "./ShopHomePage.js";
import { ShopifyImportPage } from "./ShopifyImportPage.js";
import { ShopSettingsPage } from "./ShopSettingsPage.js";
import { TaxesPage } from "./TaxesPage.js";

/**
 * Every screen of the Shop section, under /commerce, made for the signed-in admin route
 * that router.tsx passes in. This is the shop's one registration point in the admin.
 *
 * Params are read with `strict: false` because these routes are made for any parent; each
 * path has exactly the one param its component reads.
 */
export function commerceRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  const page = <Path extends string>(path: Path, component: () => React.ReactNode) =>
    createRoute({ getParentRoute, path, component });

  return [
    page("/commerce", ShopHomePage),
    page("/commerce/products", ProductsPage),
    page("/commerce/products/$productId", function ProductRoute() {
      const { productId = "new" } = useParams({ strict: false });
      return <ProductEditorPage key={productId} productId={productId} />;
    }),
    page("/commerce/orders", OrdersPage),
    page("/commerce/orders/$orderId", function OrderRoute() {
      const { orderId = "" } = useParams({ strict: false });
      return <OrderDetailPage key={orderId} orderId={orderId} />;
    }),
    page("/commerce/customers", CustomersPage),
    page("/commerce/customers/$customerId", function CustomerRoute() {
      const { customerId = "" } = useParams({ strict: false });
      return <CustomerDetailPage key={customerId} customerId={customerId} />;
    }),
    page("/commerce/discounts", DiscountsPage),
    page("/commerce/discounts/$discountId", function DiscountRoute() {
      const { discountId = "new" } = useParams({ strict: false });
      return <DiscountEditorPage key={discountId} discountId={discountId} />;
    }),
    page("/commerce/import/shopify", ShopifyImportPage),
    page("/commerce/settings", ShopSettingsPage),
    page("/commerce/settings/markets", MarketsPage),
    page("/commerce/settings/shipping", ShippingPage),
    page("/commerce/settings/taxes", TaxesPage),
    page("/commerce/settings/payments", PaymentsPage),
  ] as const;
}
