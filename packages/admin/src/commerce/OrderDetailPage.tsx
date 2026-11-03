import { ExternalLink, PackageCheck, Undo2, XCircle } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { CancelOrderDialog } from "./CancelOrderDialog.js";
import { FulfilDialog } from "./FulfilDialog.js";
import { formatMoney, countryName } from "./money.js";
import type { Order } from "./orders.api.js";
import { formatOrderDate } from "./orderDates.js";
import { OrderStatusBadge } from "./OrderStatusBadge.js";
import { OrderTimeline } from "./OrderTimeline.js";
import { RefundDialog } from "./RefundDialog.js";
import { useOrder } from "./shop.queries.js";

type OpenDialog = "fulfil" | "refund" | "cancel" | null;

/** /commerce/orders/:id: what was bought, where it goes, and everything that happened. */
export function OrderDetailPage({ orderId }: { orderId: string }) {
  const order = useOrder(orderId);
  return (
    <>
      <BackLink to="/commerce/orders">{t("shop.orders.title")}</BackLink>
      {order.isError && <LoadError error={order.error} onRetry={() => void order.refetch()} />}
      {order.isPending && (
        <LoadingRegion label={t("shop.orders.loadingOne")}>
          <Skeleton className="mb-8 h-10 w-60 rounded-control" />
          <Skeleton className="h-64 max-w-4xl rounded-card" />
        </LoadingRegion>
      )}
      {order.data && <OrderDetail order={order.data} />}
    </>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const canUpdate = useCan("commerce:update");
  const canRefund = useCan("commerce:refund");
  const toSend = order.lines.reduce((sum, line) => sum + line.unfulfilledQuantity, 0);
  const address = order.shippingAddress;

  return (
    <>
      <LargeTitle
        title={t("shop.orders.orderTitle", { name: order.name })}
        subtitle={t("shop.orders.placedOn", {
          date: formatOrderDate(order.createdAt),
          email: order.email,
        })}
        actions={
          <>
            {canRefund && !order.cancelled && order.fulfilmentStatus === "unfulfilled" && (
              <Button
                variant="plain"
                icon={<XCircle aria-hidden="true" />}
                onClick={() => setDialog("cancel")}
              >
                {t("shop.orders.cancel")}
              </Button>
            )}
            {canRefund && order.refundable.amount > 0 && (
              <Button
                variant="tinted"
                icon={<Undo2 aria-hidden="true" />}
                onClick={() => setDialog("refund")}
              >
                {t("shop.orders.refund")}
              </Button>
            )}
            {canUpdate && !order.cancelled && toSend > 0 && (
              <Button
                icon={<PackageCheck aria-hidden="true" />}
                onClick={() => setDialog("fulfil")}
              >
                {t("shop.orders.fulfil")}
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        {order.cancelled && order.cancelReason && (
          <span className="text-footnote text-label-secondary">{order.cancelReason}</span>
        )}
      </div>

      <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Card title={t("shop.orders.itemsHeader")}>
            <ul className="flex flex-col divide-y divide-separator">
              {order.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-body text-label">{line.productTitle}</p>
                    <p className="text-footnote text-label-secondary">
                      {[line.variantTitle !== "Default" ? line.variantTitle : null, line.sku]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-footnote text-label-secondary">
                      {t("shop.orders.lineProgress", {
                        sent: line.fulfilledQuantity,
                        refunded: line.refundedQuantity,
                        quantity: line.quantity,
                      })}
                    </p>
                  </div>
                  <p className="shrink-0 text-body text-label tabular-nums">
                    {line.quantity} × {formatMoney(line.unitPrice)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          <PaymentSummary order={order} />
          <Card title={t("shop.orders.timelineHeader")}>
            <OrderTimeline order={order} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title={t("shop.orders.customerHeader")}>
            <address className="text-body text-label not-italic">
              {[
                address.name,
                address.company,
                address.line1,
                address.line2,
                address.city,
                address.region,
                address.postalCode,
              ]
                .filter(Boolean)
                .map((part) => (
                  <span key={part} className="block">
                    {part}
                  </span>
                ))}
              <span className="block">{countryName(address.country)}</span>
              {address.phone && <span className="block text-label-secondary">{address.phone}</span>}
            </address>
            <a
              className="mt-3 text-body text-accent underline decoration-1 underline-offset-2 hover:decoration-2"
              href={`mailto:${order.email}`}
            >
              {order.email}
            </a>
          </Card>
          {order.fulfilments.length > 0 && (
            <Card title={t("shop.orders.shipmentsHeader")}>
              <ul className="flex flex-col gap-3">
                {order.fulfilments.map((fulfilment) => (
                  <li key={fulfilment.id} className="text-body text-label">
                    <p>{formatOrderDate(fulfilment.createdAt)}</p>
                    <p className="text-footnote text-label-secondary">
                      {fulfilment.trackingNumber
                        ? `${fulfilment.trackingCompany} ${fulfilment.trackingNumber}`.trim()
                        : t("shop.orders.noTracking")}
                    </p>
                    {fulfilment.trackingUrl && (
                      <a
                        className="text-footnote text-accent"
                        href={fulfilment.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("shop.orders.track")}
                        <span className="sr-only"> {t("help.newTab")}</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {order.stripePaymentUrl && (
            <a
              href={order.stripePaymentUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-1 text-footnote text-accent"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              {t("shop.orders.viewInStripe")}
              <span className="sr-only"> {t("help.newTab")}</span>
            </a>
          )}
        </div>
      </div>

      {dialog === "fulfil" && <FulfilDialog order={order} onClose={() => setDialog(null)} />}
      {dialog === "refund" && <RefundDialog order={order} onClose={() => setDialog(null)} />}
      {dialog === "cancel" && <CancelOrderDialog order={order} onClose={() => setDialog(null)} />}
    </>
  );
}

function PaymentSummary({ order }: { order: Order }) {
  const discounts = order.discounts ?? [];
  const onItems = discounts.filter((discount) => !discount.freeShipping);
  const freeDelivery = discounts.some((discount) => discount.freeShipping);
  const discountRows =
    onItems.length > 0
      ? onItems.map((discount) => ({
          label: discount.code
            ? `${t("shop.orders.discountCode", { code: discount.code })} · ${discount.title}`
            : discount.title,
          value: `−${formatMoney(discount.amount)}`,
        }))
      : order.discount.amount > 0
        ? [{ label: t("shop.orders.discount"), value: `−${formatMoney(order.discount)}` }]
        : [];
  const shippingName = t("shop.orders.shippingLine", { name: order.shippingLine.name });
  const rows = [
    { label: t("shop.orders.subtotal"), value: formatMoney(order.subtotal) },
    ...discountRows,
    {
      label: freeDelivery ? t("shop.orders.freeDelivery", { name: shippingName }) : shippingName,
      value: formatMoney(order.shipping),
    },
    {
      label: order.taxesIncluded ? t("shop.orders.taxIncluded") : t("shop.orders.tax"),
      value: formatMoney(order.tax),
    },
  ];
  return (
    <Card title={t("shop.orders.paymentHeader")}>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-body">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-label-secondary">{row.label}</dt>
            <dd className="text-end text-label tabular-nums">{row.value}</dd>
          </div>
        ))}
        <dt className="pt-2 font-semibold text-label">{t("shop.orders.total")}</dt>
        <dd className="pt-2 text-end font-semibold text-label tabular-nums">
          {formatMoney(order.total)}
        </dd>
        {order.refunded.amount > 0 && (
          <>
            <dt className="text-label-secondary">{t("shop.orders.refunded")}</dt>
            <dd className="text-end text-label tabular-nums">−{formatMoney(order.refunded)}</dd>
          </>
        )}
      </dl>
    </Card>
  );
}
