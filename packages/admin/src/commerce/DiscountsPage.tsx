import { Plus, Tag, Zap } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import type { Tone } from "../design/tones.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { DiscountStatus } from "./discounts.api.js";
import { useDiscounts } from "./discounts.queries.js";
import { useSummaryContext } from "./useSummaryContext.js";
import { summariseDiscount } from "./discountSummary.js";

const STATUS_TONES: Record<DiscountStatus, Tone> = {
  active: "success",
  scheduled: "accent",
  expired: "neutral",
  used_up: "neutral",
  off: "neutral",
};

/** /commerce/discounts: every code and automatic discount, each summed up in a sentence. */
export function DiscountsPage() {
  const discounts = useDiscounts();
  const context = useSummaryContext();
  const canChange = useCan("commerce:update");
  const addButton = canChange && (
    <LinkButton
      to="/commerce/discounts/$discountId"
      params={{ discountId: "new" }}
      icon={<Plus aria-hidden="true" />}
    >
      {t("shop.discounts.add")}
    </LinkButton>
  );

  return (
    <>
      <BackLink to="/commerce">{t("shop.title")}</BackLink>
      <LargeTitle
        title={t("shop.discounts.title")}
        subtitle={t("shop.discounts.subtitle")}
        actions={discounts.data?.length ? addButton : undefined}
      />
      {discounts.isError && (
        <LoadError error={discounts.error} onRetry={() => void discounts.refetch()} />
      )}
      {discounts.isPending && (
        <LoadingRegion label={t("shop.discounts.loading")}>
          <Skeleton className="h-40 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {discounts.data?.length === 0 && (
        <div className="max-w-2xl rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Tag}
            title={t("shop.discounts.emptyTitle")}
            description={t("shop.discounts.emptyDescription")}
            action={addButton}
          />
        </div>
      )}
      {discounts.data && discounts.data.length > 0 && context && (
        <div className="max-w-2xl">
          <GroupedList footer={t("shop.discounts.footer")}>
            {discounts.data.map((discount) => (
              <GroupedListRow
                key={discount.id}
                icon={discount.method === "code" ? Tag : Zap}
                iconTone={discount.status === "active" ? "accent" : "neutral"}
                label={
                  discount.method === "code"
                    ? `${discount.code ?? ""} · ${discount.title}`
                    : discount.title
                }
                description={summariseDiscount(discount, context)}
                wrapsText
                accessory={
                  <Badge tone={STATUS_TONES[discount.status]}>
                    {t(`shop.discounts.status.${discount.status}`)}
                  </Badge>
                }
                to={`/commerce/discounts/${discount.id}`}
              />
            ))}
          </GroupedList>
        </div>
      )}
    </>
  );
}
