import { Receipt } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SearchField } from "../design/SearchField.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { formatMoney } from "./money.js";
import type { OrderFilter } from "./orders.api.js";
import { OrderStatusBadge } from "./OrderStatusBadge.js";
import { formatOrderDate } from "./orderDates.js";
import { useOrders } from "./shop.queries.js";

/** /commerce/orders: every paid order, newest first, with "to send" one tap away. */
export function OrdersPage() {
  const [view, setView] = useState<OrderFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const orders = useOrders({ view, search: debouncedSearch || undefined });
  const isFiltered = view !== "all" || debouncedSearch !== "";

  return (
    <>
      <BackLink to="/commerce">{t("shop.title")}</BackLink>
      <LargeTitle title={t("shop.orders.title")} subtitle={t("shop.orders.subtitle")} />

      <div className="mb-5 flex max-w-3xl flex-wrap items-center gap-3">
        <div className="min-w-60 flex-1">
          <SearchField label={t("shop.orders.search")} value={search} onValueChange={setSearch} />
        </div>
        <SegmentedControl<OrderFilter>
          label={t("shop.orders.filter")}
          value={view}
          onChange={setView}
          options={[
            { value: "all", label: t("shop.orders.filterAll") },
            { value: "unfulfilled", label: t("shop.orders.filterToSend") },
            { value: "fulfilled", label: t("shop.orders.filterSent") },
            { value: "refunded", label: t("shop.orders.filterRefunded") },
          ]}
        />
      </div>

      {orders.isError && <LoadError error={orders.error} onRetry={() => void orders.refetch()} />}
      {orders.isPending && (
        <LoadingRegion label={t("shop.orders.loading")}>
          <Skeleton className="h-40 max-w-3xl rounded-card" />
        </LoadingRegion>
      )}
      {orders.data?.total === 0 && (
        <div className="max-w-3xl rounded-card bg-surface">
          {isFiltered ? (
            <EmptyState icon={Receipt} title={t("shop.orders.noMatches")} />
          ) : (
            <EmptyState
              size="page"
              icon={Receipt}
              title={t("shop.orders.emptyTitle")}
              description={t("shop.orders.emptyDescription")}
              action={
                <LinkButton variant="tinted" to="/commerce">
                  {t("shop.orders.emptyAction")}
                </LinkButton>
              }
            />
          )}
        </div>
      )}
      {orders.data && orders.data.total > 0 && (
        <div className="max-w-3xl">
          <GroupedList footer={t("shop.orders.count", { count: orders.data.total })}>
            {orders.data.items.map((order) => (
              <GroupedListRow
                key={order.id}
                icon={Receipt}
                iconTone={
                  order.fulfilmentStatus === "fulfilled" || order.cancelled ? "neutral" : "success"
                }
                label={`${order.name} · ${order.customerName}`}
                description={`${formatOrderDate(order.createdAt)} · ${formatMoney(order.total)} · ${t("shop.orders.items", { count: order.itemCount })}`}
                accessory={<OrderStatusBadge status={order.status} />}
                to={`/commerce/orders/${encodeURIComponent(order.id)}`}
              />
            ))}
          </GroupedList>
        </div>
      )}
    </>
  );
}
