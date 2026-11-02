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
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { ShopMenuStep, useShopMenuOffer } from "./ShopMenuOffer.js";
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
  const done = steps.filter((step) => step.done);
  const toDo = steps.filter((step) => !step.done);
  const menuOffer = useShopMenuOffer();
  // Checkout uses each market's own payment provider; one that isn't connected can't take orders.
  const connected = {
    stripe: payments.data?.connected ?? false,
    paypal: providers.data?.paypal.connected ?? false,
    mollie: providers.data?.mollie.connected ?? false,
  };
  const sellsIn = providers.data?.markets ?? markets.data ?? [];
  const lacksPayments =
    sellsIn.length === 0 ||
    sellsIn.every(
      (market) => !connected["paymentProvider" in market ? market.paymentProvider : "stripe"],
    );
  const lacksDelivery = !(steps[1]?.done ?? false);
  // Matches the website: until a market can be paid and something can be delivered, products
  // show as "Coming soon" (LINTEL-UX-009).
  const isOpen = !lacksPayments && !lacksDelivery;
  const showsSetup = Boolean(
    isLoaded && (toDo.length > 0 || menuOffer.isOffered || menuOffer.isAdded),
  );
  // The setup list already explains a new shop. Once setup is done, the only thing left that
  // stops a sale is a market paying with a provider that isn't connected (LINTEL-LEFT-002).
  const showsWarning = Boolean(isLoaded && toDo.length === 0 && !isOpen);

  return (
    <>
      <LargeTitle title={t("shop.title")} subtitle={t("shop.subtitle")} />
      <div className="flex max-w-2xl flex-col gap-8">
        {showsWarning && (
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
        {showsSetup && (
          <section
            aria-labelledby="shop-setup-title"
            className="flex flex-col overflow-hidden rounded-card bg-surface"
          >
            <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
              <div className="flex flex-col gap-0.5">
                <h2 id="shop-setup-title" className="text-headline text-label">
                  {toDo.length > 0 ? t("shop.setup.header") : t("shop.setup.ready")}
                </h2>
                <p className="text-footnote text-label-secondary">
                  {isOpen ? t("shop.setup.openIntro") : t("shop.setup.comingSoonIntro")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  role="progressbar"
                  aria-label={t("shop.setup.header")}
                  aria-valuemin={0}
                  aria-valuemax={steps.length}
                  aria-valuenow={done.length}
                  aria-valuetext={t("shop.setup.progress", {
                    done: done.length,
                    total: steps.length,
                  })}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill"
                >
                  <div
                    className="h-full rounded-full bg-accent-fill"
                    style={{ width: `${(done.length / steps.length) * 100}%` }}
                  />
                </div>
                <span className="shrink-0 text-footnote font-medium text-label-secondary">
                  {t("shop.setup.progress", { done: done.length, total: steps.length })}
                </span>
              </div>
            </div>
            <ul className="hairline-top">
              {toDo.map((step) => (
                <GroupedListRow
                  key={step.to}
                  icon={step.icon}
                  label={step.label}
                  description={step.description}
                  wrapsText
                  to={step.to}
                />
              ))}
              <ShopMenuStep offer={menuOffer} />
            </ul>
            {done.length > 0 && (
              <p className="flex items-start gap-2 px-4 py-3 text-footnote text-label-secondary hairline-top">
                <CircleCheck aria-hidden="true" className="mt-px size-4 shrink-0 text-success" />
                <span>
                  {t("shop.setup.doneList", { steps: done.map((step) => step.label).join(", ") })}
                </span>
              </p>
            )}
          </section>
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
