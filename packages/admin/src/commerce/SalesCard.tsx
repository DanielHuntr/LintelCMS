import { ShoppingBag } from "lucide-react";
import { Card } from "../design/Card.js";
import { EmptyState } from "../design/EmptyState.js";
import { LinkButton } from "../design/LinkButton.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, tCount } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { formatMoney } from "./money.js";
import { useSalesSummary } from "./shop.queries.js";

/**
 * The dashboard's Sales card: the last 30 days in the shop's own currency, a bar per day,
 * and what's waiting to be sent. The dashboard shows it while the shop plugin is on.
 */
export function SalesCard() {
  const canSee = useCan("commerce:read");
  const sales = useSalesSummary(30);
  if (!canSee) return null;

  const primary =
    sales.data?.byCurrency.find((row) => row.currency === sales.data?.primaryCurrency) ??
    sales.data?.byCurrency[0];
  const daily = sales.data?.daily ?? [];
  const highest = Math.max(1, ...daily.map((day) => day.sales.amount));

  return (
    <Card
      title={t("dashboard.sales.title")}
      accessory={
        <LinkButton variant="plain" size="small" to="/commerce/orders">
          {t("shop.sales.allOrders")}
        </LinkButton>
      }
    >
      {sales.isPending && <Skeleton className="h-24 rounded-card" />}
      {sales.data && !primary && (
        <EmptyState
          icon={ShoppingBag}
          title={t("dashboard.sales.emptyTitle")}
          description={t("dashboard.sales.emptyDescription")}
        />
      )}
      {sales.data && primary && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div>
              <p className="text-footnote text-label-secondary">{t("shop.sales.last30Days")}</p>
              <p className="text-large-title text-label tabular-nums">
                {formatMoney(primary.sales)}
              </p>
            </div>
            <p className="text-body text-label-secondary">
              {tCount(
                { one: "shop.orders.count.one", other: "shop.orders.count.other" },
                primary.orderCount,
              )}
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
          {sales.data.ordersToFulfil > 0 && (
            <p className="text-body text-warning">
              {tCount(
                { one: "shop.sales.toSend.one", other: "shop.sales.toSend.other" },
                sales.data.ordersToFulfil,
              )}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
