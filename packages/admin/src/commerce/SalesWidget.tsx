import { ShoppingBag } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { EmptyState } from "../design/EmptyState.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { formatMoney } from "./money.js";
import { useSalesSummary } from "./shop.queries.js";

/**
 * The dashboard's Sales widget: the last 30 days in the shop's own currency (the API's
 * `summariseSales`), a bar per day, and what's waiting to be sent. It is the online shop
 * plugin's, so it shows only while the shop is on, to people with `commerce:read`.
 */
export function SalesWidget() {
  const sales = useSalesSummary(30);

  if (sales.isError) {
    return <LoadError error={sales.error} onRetry={() => void sales.refetch()} />;
  }
  if (!sales.data) {
    return (
      <LoadingRegion label={t("dashboard.loading")}>
        <Skeleton className="h-24 w-full rounded-card" />
      </LoadingRegion>
    );
  }

  const primary =
    sales.data.byCurrency.find((row) => row.currency === sales.data.primaryCurrency) ??
    sales.data.byCurrency[0];
  if (!primary) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={t("dashboard.sales.emptyTitle")}
        description={t("dashboard.sales.emptyDescription")}
      />
    );
  }
  const daily = sales.data.daily;
  const highest = Math.max(1, ...daily.map((day) => day.sales.amount));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="text-footnote text-label-secondary">{t("shop.sales.last30Days")}</p>
          <p className="text-large-title text-label tabular-nums">{formatMoney(primary.sales)}</p>
        </div>
        <p className="text-body text-label-secondary">
          {t("shop.orders.count", { count: primary.orderCount })}
          {" · "}
          {t("shop.sales.average", { amount: formatMoney(primary.averageOrder) })}
        </p>
      </div>
      {daily.length > 1 && (
        <div aria-hidden="true" className="flex h-12 items-end gap-0.5">
          {daily.map((day) => (
            <span
              key={day.date}
              className="flex-1 rounded-t-sm bg-accent-fill/70"
              style={{ height: `${Math.max(6, (day.sales.amount / highest) * 100)}%` }}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {sales.data.ordersToFulfil > 0 ? (
          <p className="text-body text-warning">
            {t("shop.sales.toSend", { count: sales.data.ordersToFulfil })}
          </p>
        ) : (
          <span />
        )}
        <LinkButton variant="plain" size="small" to="/commerce/orders">
          {t("shop.sales.allOrders")}
        </LinkButton>
      </div>
    </div>
  );
}
