import {
  ArrowRightLeft,
  CircleCheck,
  CreditCard,
  Globe,
  LayoutGrid,
  Package,
  Receipt,
  Settings,
  Tag,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "../design/Badge.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { usePaymentProviders } from "./paymentProviders.queries.js";
import { useProducts } from "./shop.queries.js";
import { useMarkets, usePaymentSettings, useShippingZones } from "./shopSettings.queries.js";

/**
 * /commerce: the shop's home. Until the shop is ready to sell, it leads with the four steps
 * that get it there, in order, each linking to the screen that does it.
 */
export function ShopHomePage() {
  const markets = useMarkets();
  const zones = useShippingZones();
  const payments = usePaymentSettings();
  const products = useProducts({});
  const providers = usePaymentProviders();

  const steps = [
    {
      done: (markets.data?.length ?? 0) > 0,
      icon: Globe,
      label: t("shop.setup.markets"),
      description: t("shop.setup.marketsDescription"),
      to: "/commerce/settings/markets",
    },
    {
      done: zones.data?.some((zone) => zone.rates.length > 0) ?? false,
      icon: Truck,
      label: t("shop.setup.shipping"),
      description: t("shop.setup.shippingDescription"),
      to: "/commerce/settings/shipping",
    },
    {
      done: payments.data?.connected ?? false,
      icon: CreditCard,
      label: t("shop.setup.payments"),
      description: t("shop.setup.paymentsDescription"),
      to: "/commerce/settings/payments",
    },
    {
      done: (products.data?.total ?? 0) > 0,
      icon: Package,
      label: t("shop.setup.product"),
      description: t("shop.setup.productDescription"),
      to: "/commerce/products/new",
    },
  ];
  const isLoaded = markets.data && zones.data && payments.data && products.data;
  const remaining = steps.filter((step) => !step.done).length;
  // Checkout uses each market's own payment provider; one that isn't connected can't take orders.
  const connected = {
    stripe: payments.data?.connected ?? false,
    paypal: providers.data?.paypal.connected ?? false,
    mollie: providers.data?.mollie.connected ?? false,
  };
  const marketsWithoutPayments = (providers.data?.markets ?? markets.data ?? []).filter(
    (market) => !connected["paymentProvider" in market ? market.paymentProvider : "stripe"],
  );
  const showsNotTakingOrders = Boolean(isLoaded && marketsWithoutPayments.length > 0);

  return (
    <>
      <LargeTitle title={t("shop.title")} subtitle={t("shop.subtitle")} />
      <div className="flex max-w-2xl flex-col gap-8">
        {showsNotTakingOrders && (
          <p className="flex items-start gap-2 rounded-control bg-warning/12 px-3 py-2 text-footnote text-label">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              {t("shop.notTakingOrders")}{" "}
              <Link
                to="/commerce/settings/payments"
                className="font-medium text-accent hover:underline focus-visible:focus-ring"
              >
                {t("shop.notTakingOrdersAction")}
              </Link>
            </span>
          </p>
        )}
        {isLoaded && remaining > 0 && (
          <GroupedList
            header={t("shop.setup.header")}
            footer={t("shop.setup.footer", { count: remaining })}
          >
            {steps.map((step) => (
              <GroupedListRow
                key={step.to}
                icon={step.done ? CircleCheck : step.icon}
                iconTone={step.done ? "success" : "accent"}
                label={step.label}
                description={step.description}
                wrapsText
                accessory={
                  step.done ? <Badge tone="success">{t("shop.setup.done")}</Badge> : undefined
                }
                to={step.to}
              />
            ))}
          </GroupedList>
        )}
        <GroupedList header={t("shop.sectionsHeader")}>
          <GroupedListRow
            icon={Package}
            label={t("shop.products.title")}
            description={t("shop.products.rowDescription")}
            to="/commerce/products"
          />
          <GroupedListRow
            icon={LayoutGrid}
            label={t("shop.collections.title")}
            description={t("shop.collections.rowDescription")}
            to="/commerce/collections"
          />
          <GroupedListRow
            icon={Receipt}
            iconTone="success"
            label={t("shop.orders.title")}
            description={t("shop.orders.rowDescription")}
            to="/commerce/orders"
          />
          <GroupedListRow
            icon={Users}
            iconTone="warning"
            label={t("shop.customers.title")}
            description={t("shop.customers.rowDescription")}
            to="/commerce/customers"
          />
          <GroupedListRow
            icon={Tag}
            iconTone="danger"
            label={t("shop.discounts.title")}
            description={t("shop.discounts.rowDescription")}
            to="/commerce/discounts"
          />
          <GroupedListRow
            icon={Settings}
            iconTone="neutral"
            label={t("shop.settings.title")}
            description={t("shop.settings.rowDescription")}
            to="/commerce/settings"
          />
        </GroupedList>
        <GroupedList header={t("shop.import.homeHeader")}>
          <GroupedListRow
            icon={ArrowRightLeft}
            iconTone="neutral"
            label={t("shop.import.title")}
            description={t("shop.import.rowDescription")}
            wrapsText
            to="/commerce/import/shopify"
          />
        </GroupedList>
      </div>
    </>
  );
}
