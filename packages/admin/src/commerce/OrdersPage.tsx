import { Archive, Receipt } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
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
import { useImportedOrders } from "./shopifyImport.queries.js";

/** The order filters, plus "Imported" (orders from before a move from Shopify) when any exist. */
type OrdersView = OrderFilter | "imported";

/** /commerce/orders: every paid order, newest first, with "to send" one tap away. */
export function OrdersPage() {
  const [view, setView] = useState<OrdersView>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const showingImported = view === "imported";
  const orders = useOrders({
    view: showingImported ? "all" : view,
    search: debouncedSearch || undefined,
  });
  const imported = useImportedOrders();
  const hasImported = (imported.data?.total ?? 0) > 0;
  const wanted = debouncedSearch.trim().toLowerCase();
  const importedShown = (imported.data?.items ?? []).filter((order) =>
    `${order.name} ${order.email}`.toLowerCase().includes(wanted),
  );
  const isFiltered = view !== "all" || debouncedSearch !== "";

  return (
    <>
      <BackLink to="/commerce">{t("shop.title")}</BackLink>
      <LargeTitle title={t("shop.orders.title")} subtitle={t("shop.orders.subtitle")} />

      <div className="mb-5 flex max-w-3xl flex-wrap items-center gap-3">
        <div className="min-w-60 flex-1">
          <SearchField label={t("shop.orders.search")} value={search} onValueChange={setSearch} />
        </div>
        <SegmentedControl<OrdersView>
          label={t("shop.orders.filter")}
          value={view}
          onChange={setView}
          options={[
            { value: "all", label: t("shop.orders.filterAll") },
            { value: "unfulfilled", label: t("shop.orders.filterToSend") },
            { value: "fulfilled", label: t("shop.orders.filterSent") },
            { value: "refunded", label: t("shop.orders.filterRefunded") },
            ...(hasImported
              ? [{ value: "imported" as const, label: t("shop.orders.filterImported") }]
              : []),
          ]}
        />
      </div>

      {showingImported && imported.data && importedShown.length === 0 && (
        <div className="max-w-3xl rounded-card bg-surface">
          <EmptyState icon={Archive} title={t("shop.orders.noMatches")} />
        </div>
      )}
      {showingImported && importedShown.length > 0 && (
        <div className="max-w-3xl">
          <GroupedList footer={t("shop.customers.archivedFooter")}>
            {importedShown.map((order) => (
              <GroupedListRow
                key={order.id}
                icon={Archive}
                iconTone="neutral"
                label={t("shop.orders.importedRow", { name: order.name, email: order.email })}
                description={`${formatOrderDate(order.placedAt)} · ${formatMoney(order.total)} · ${t("shop.orders.items", { count: order.itemCount })}`}
                detail={order.paymentStatus}
                to={
                  order.customerId
                    ? `/commerce/customers/${encodeURIComponent(order.customerId)}`
                    : undefined
                }
              />
            ))}
          </GroupedList>
        </div>
      )}

      {!showingImported && orders.isError && (
        <LoadError error={orders.error} onRetry={() => void orders.refetch()} />
      )}
      {!showingImported && orders.isPending && (
        <LoadingRegion label={t("shop.orders.loading")}>
          <Skeleton className="h-40 max-w-3xl rounded-card" />
        </LoadingRegion>
      )}
      {!showingImported && orders.data?.total === 0 && !imported.isPending && (
        <div className="max-w-3xl rounded-card bg-surface">
          {isFiltered ? (
            <EmptyState icon={Receipt} title={t("shop.orders.noMatches")} />
          ) : hasImported ? (
            // Only orders brought over from Shopify: point to them rather than "No orders yet".
            <EmptyState
              size="page"
              icon={Archive}
              title={t("shop.orders.onlyImportedTitle")}
              description={t("shop.orders.onlyImportedDescription", {
                count: imported.data?.total ?? 0,
              })}
              action={
                <Button variant="tinted" onClick={() => setView("imported")}>
                  {t("shop.orders.showImported")}
                </Button>
              }
            />
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
      {!showingImported && orders.data && orders.data.total > 0 && (
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
