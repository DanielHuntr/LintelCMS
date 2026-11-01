import { Pencil, Plus, Truck } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { countryName, formatMoney } from "./money.js";
import { RateDialog } from "./RateDialog.js";
import type { ShippingRate, ShippingZone } from "./shopSettings.api.js";
import { usePrimaryCurrency, useShippingZones } from "./shopSettings.queries.js";
import { ZoneDialog } from "./ZoneDialog.js";

type Editing =
  | { kind: "zone"; zone: ShippingZone | null }
  | { kind: "rate"; zone: ShippingZone; rate: ShippingRate | null }
  | null;

/** /commerce/settings/shipping: where the shop delivers, and what it costs. */
export function ShippingPage() {
  const zones = useShippingZones();
  const currency = usePrimaryCurrency();
  const canChange = useCan("commerce:update");
  const [editing, setEditing] = useState<Editing>(null);

  const addZone = canChange && (
    <Button
      icon={<Plus aria-hidden="true" />}
      onClick={() => setEditing({ kind: "zone", zone: null })}
    >
      {t("shop.shipping.addZone")}
    </Button>
  );

  function describeRate(rate: ShippingRate): string {
    if (!currency) return rate.name;
    const amount =
      rate.kind === "flat" ? rate.amounts[currency] : rate.weightBrackets[0]?.amounts[currency];
    const price =
      amount === undefined
        ? t("shop.shipping.noPrice")
        : rate.kind === "flat"
          ? formatMoney({ amount, currency })
          : t("shop.shipping.fromPrice", { price: formatMoney({ amount, currency }) });
    const free = rate.freeOverAmounts?.[currency];
    return [
      price,
      free !== undefined
        ? t("shop.shipping.freeOver", { amount: formatMoney({ amount: free, currency }) })
        : null,
      rate.deliveryEstimate || null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <>
      <BackLink to="/commerce/settings">{t("shop.settings.title")}</BackLink>
      <LargeTitle
        title={t("shop.shipping.title")}
        subtitle={t("shop.shipping.subtitle")}
        actions={zones.data?.length === 0 ? undefined : addZone}
      />
      {zones.isError && <LoadError error={zones.error} onRetry={() => void zones.refetch()} />}
      {zones.isPending && (
        <LoadingRegion label={t("shop.shipping.loading")}>
          <Skeleton className="h-28 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {zones.data?.length === 0 && (
        <div className="max-w-2xl rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Truck}
            title={t("shop.shipping.emptyTitle")}
            description={t("shop.shipping.emptyDescription")}
            action={addZone}
          />
        </div>
      )}
      <div className="flex max-w-2xl flex-col gap-8">
        {zones.data?.map((zone) => (
          <section key={zone.id} aria-label={zone.name} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="text-headline text-label">{zone.name}</h2>
                <p className="truncate text-footnote text-label-secondary">
                  {zone.countries.length === 0
                    ? t("shop.shipping.noCountries")
                    : zone.countries.map(countryName).join(", ")}
                </p>
              </div>
              {canChange && (
                <Button
                  variant="plain"
                  size="small"
                  icon={<Pencil aria-hidden="true" />}
                  onClick={() => setEditing({ kind: "zone", zone })}
                >
                  {t("shop.shipping.editZone")}
                </Button>
              )}
            </div>
            {zone.rates.length > 0 && (
              <GroupedList>
                {zone.rates.map((rate) => (
                  <GroupedListRow
                    key={rate.id}
                    icon={Truck}
                    iconTone="success"
                    label={rate.name}
                    description={describeRate(rate)}
                    onSelect={
                      canChange ? () => setEditing({ kind: "rate", zone, rate }) : undefined
                    }
                  />
                ))}
              </GroupedList>
            )}
            {zone.rates.length === 0 && (
              <p className="px-1 text-footnote text-warning">{t("shop.shipping.zoneHasNoRates")}</p>
            )}
            {canChange && (
              <div>
                <Button
                  variant="tinted"
                  size="small"
                  icon={<Plus aria-hidden="true" />}
                  onClick={() => setEditing({ kind: "rate", zone, rate: null })}
                >
                  {t("shop.shipping.addRate")}
                </Button>
              </div>
            )}
          </section>
        ))}
      </div>
      {editing?.kind === "zone" && (
        <ZoneDialog zone={editing.zone} onClose={() => setEditing(null)} />
      )}
      {editing?.kind === "rate" && currency && (
        <RateDialog
          zone={editing.zone}
          rate={editing.rate}
          currency={currency}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
