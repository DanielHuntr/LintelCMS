import { Badge } from "../design/Badge.js";
import type { Tone } from "../design/tones.js";
import { t } from "../i18n/strings.js";
import type { OrderStatus } from "./orders.api.js";

const tones: Record<OrderStatus, Tone> = {
  paid: "accent",
  partially_fulfilled: "warning",
  fulfilled: "success",
  partially_refunded: "warning",
  refunded: "neutral",
  cancelled: "danger",
};

/** One word for where an order is: "Paid", "Fulfilled", "Refunded"... */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={tones[status]}>{t(`shop.orderStatus.${status}`)}</Badge>;
}
