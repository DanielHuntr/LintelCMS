import { Badge } from "../design/Badge.js";
import { t } from "../i18n/strings.js";
import type { DeliveryStatus } from "./webhooks.api.js";

/** "Delivered", "Retrying" or "Failed", in the colour that goes with it. */
export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  if (status === "delivered") return <Badge tone="success">{t("webhooks.status.delivered")}</Badge>;
  if (status === "failed") return <Badge tone="danger">{t("webhooks.status.failed")}</Badge>;
  return <Badge tone="warning">{t("webhooks.status.pending")}</Badge>;
}
