import { Receipt } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { controlClasses } from "../design/controlStyles.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { countryName, formatMoney } from "./money.js";
import { ArchivedOrders } from "./ArchivedOrders.js";
import type { Customer } from "./orders.api.js";
import { formatOrderDate } from "./orderDates.js";
import { OrderStatusBadge } from "./OrderStatusBadge.js";
import { useCustomer, useOrders, useUpdateCustomer } from "./shop.queries.js";

/** /commerce/customers/:id: their orders, addresses and a private note. */
export function CustomerDetailPage({ customerId }: { customerId: string }) {
  const customer = useCustomer(customerId);
  return (
    <>
      <BackLink to="/commerce/customers">{t("shop.customers.title")}</BackLink>
      {customer.isError && (
        <LoadError error={customer.error} onRetry={() => void customer.refetch()} />
      )}
      {customer.isPending && (
        <LoadingRegion label={t("shop.customers.loadingOne")}>
          <Skeleton className="h-64 max-w-4xl rounded-card" />
        </LoadingRegion>
      )}
      {customer.data && <CustomerDetail customer={customer.data} />}
    </>
  );
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const orders = useOrders({ customerId: customer.id });
  const [note, setNote] = useState(customer.note);
  const update = useUpdateCustomer(customer.id);
  const canWrite = useCan("commerce:update");

  return (
    <>
      <LargeTitle
        title={customer.name || customer.email}
        subtitle={t("shop.customers.since", {
          date: formatOrderDate(customer.createdAt),
          email: customer.email,
        })}
      />
      <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          {orders.data && orders.data.total === 0 && (
            <div className="rounded-card bg-surface">
              <EmptyState icon={Receipt} title={t("shop.customers.noOrders")} />
            </div>
          )}
          {orders.data && orders.data.total > 0 && (
            <GroupedList header={t("shop.orders.title")}>
              {orders.data.items.map((order) => (
                <GroupedListRow
                  key={order.id}
                  icon={Receipt}
                  iconTone="success"
                  label={order.name}
                  description={`${formatOrderDate(order.createdAt)} · ${formatMoney(order.total)}`}
                  accessory={<OrderStatusBadge status={order.status} />}
                  to={`/commerce/orders/${encodeURIComponent(order.id)}`}
                />
              ))}
            </GroupedList>
          )}
          <ArchivedOrders customerId={customer.id} />
        </div>
        <div className="flex flex-col gap-6">
          <Card title={t("shop.customers.spentHeader")}>
            <p className="text-title text-label tabular-nums">
              {customer.totalSpent.length > 0
                ? customer.totalSpent.map(formatMoney).join(" · ")
                : t("shop.customers.nothingSpent")}
            </p>
          </Card>
          <Card title={t("shop.customers.addressesHeader")}>
            {customer.addresses.length === 0 && (
              <p className="text-body text-label-secondary">{t("shop.customers.noAddresses")}</p>
            )}
            <ul className="flex flex-col gap-3">
              {customer.addresses.map((address) => (
                <li key={`${address.line1}-${address.postalCode}`} className="text-body text-label">
                  {[
                    address.name,
                    address.line1,
                    address.line2,
                    address.city,
                    address.postalCode,
                    countryName(address.country),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </li>
              ))}
            </ul>
          </Card>
          <Card title={t("shop.customers.noteHeader")}>
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                update.mutate({ note });
              }}
            >
              <label htmlFor="customer-note" className="sr-only">
                {t("shop.customers.noteHeader")}
              </label>
              <textarea
                id="customer-note"
                rows={4}
                value={note}
                disabled={!canWrite}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("shop.customers.notePlaceholder")}
                className={`${controlClasses()} py-2`}
              />
              {update.error && (
                <p role="alert" className="text-footnote text-danger">
                  {describeError(update.error)}
                </p>
              )}
              <p role="status" className="text-footnote text-label-secondary">
                {update.isSuccess ? t("shop.saved") : ""}
              </p>
              {canWrite && (
                <div>
                  <Button type="submit" variant="tinted" size="small" disabled={update.isPending}>
                    {t("shop.customers.saveNote")}
                  </Button>
                </div>
              )}
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
