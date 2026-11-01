import { Badge } from "../design/Badge.js";
import { t } from "../i18n/strings.js";
import type { ProductStatus } from "./products.api.js";

const tones = { active: "success", draft: "neutral", archived: "warning" } as const;

/** "Active", "Draft" or "Archived". */
export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={tones[status]}>{t(`shop.status.${status}`)}</Badge>;
}
