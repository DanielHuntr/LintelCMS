import { Globe, Plus } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { MarketDialog } from "./MarketDialog.js";
import { countryName } from "./money.js";
import type { Market } from "./shopSettings.api.js";
import { useMarkets } from "./shopSettings.queries.js";

/** /commerce/settings/markets: where the shop sells, and in which currency. */
export function MarketsPage() {
  const markets = useMarkets();
  const canChange = useCan("commerce:update");
  const [editing, setEditing] = useState<Market | "new" | null>(null);

  const addButton = canChange && (
    <Button icon={<Plus aria-hidden="true" />} onClick={() => setEditing("new")}>
      {markets.data?.length === 0 ? t("shop.markets.addFirst") : t("shop.markets.add")}
    </Button>
  );

  return (
    <>
      <BackLink to="/commerce/settings">{t("shop.settings.title")}</BackLink>
      <LargeTitle
        title={t("shop.markets.title")}
        subtitle={t("shop.markets.subtitle")}
        actions={markets.data?.length === 0 ? undefined : addButton}
      />
      {markets.isError && (
        <LoadError error={markets.error} onRetry={() => void markets.refetch()} />
      )}
      {markets.isPending && (
        <LoadingRegion label={t("shop.markets.loading")}>
          <Skeleton className="h-28 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {markets.data?.length === 0 && (
        <div className="max-w-2xl rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Globe}
            title={t("shop.markets.emptyTitle")}
            description={t("shop.markets.emptyDescription")}
            action={addButton}
          />
        </div>
      )}
      {markets.data && markets.data.length > 0 && (
        <div className="max-w-2xl">
          <GroupedList footer={t("shop.markets.footer")}>
            {markets.data.map((market) => (
              <GroupedListRow
                key={market.id}
                icon={Globe}
                iconTone={market.isPrimary ? "accent" : "neutral"}
                label={`${market.name} · ${market.currency}`}
                description={
                  market.countries.length === 0
                    ? t("shop.markets.noCountries")
                    : market.countries.map(countryName).join(", ")
                }
                accessory={
                  market.isPrimary ? (
                    <Badge tone="accent">{t("shop.markets.primary")}</Badge>
                  ) : undefined
                }
                onSelect={canChange ? () => setEditing(market) : undefined}
              />
            ))}
          </GroupedList>
        </div>
      )}
      {editing && (
        <MarketDialog
          market={editing === "new" ? null : editing}
          isFirst={markets.data?.length === 0}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
