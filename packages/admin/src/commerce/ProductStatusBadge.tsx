import { Badge } from "../design/Badge.js";
import { t } from "../i18n/strings.js";
import type { ProductStatus } from "./products.api.js";

const tones = { active: "success", draft: "neutral", archived: "warning" } as const;

/**
 * "On sale", "Draft" or "Archived", or "Sold out" for a product on sale with none left to
 * sell (`available` 0; null when stock isn't counted), as shoppers see it.
 */
export function ProductStatusBadge({
  status,
  available = null,
}: {
  status: ProductStatus;
  available?: number | null;
}) {
  if (status === "active" && available === 0) {
    return <Badge tone="warning">{t("shop.status.soldOut")}</Badge>;
  }
  return <Badge tone={tones[status]}>{t(`shop.status.${status}`)}</Badge>;
}
