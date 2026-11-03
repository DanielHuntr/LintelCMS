import { CreditCard, Globe, Mail, Percent, Truck } from "lucide-react";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { useMarkets, usePaymentSettings, useTaxSettings } from "./shopSettings.queries.js";

/** /commerce/settings: one row per area, like iOS Settings, each saying how it's set now. */
export function ShopSettingsPage() {
  const markets = useMarkets();
  const payments = usePaymentSettings();
  const taxes = useTaxSettings();
  // Shop emails are read in the outbox, which holds sign-in links: owners only.
  const canReadOutbox = useCan("*");

  return (
    <>
      <BackLink to="/commerce">{t("shop.title")}</BackLink>
      <LargeTitle title={t("shop.settings.title")} subtitle={t("shop.settings.subtitle")} />
      <div className="flex max-w-2xl flex-col gap-8">
        <GroupedList header={t("shop.settings.sellingHeader")}>
          <GroupedListRow
            icon={Globe}
            label={t("shop.markets.title")}
            description={t("shop.markets.rowDescription")}
            detail={markets.data ? String(markets.data.length) : undefined}
            to="/commerce/settings/markets"
          />
          <GroupedListRow
            icon={Truck}
            iconTone="success"
            label={t("shop.shipping.title")}
            description={t("shop.shipping.rowDescription")}
            to="/commerce/settings/shipping"
          />
          <GroupedListRow
            icon={Percent}
            iconTone="warning"
            label={t("shop.taxes.title")}
            description={t("shop.taxes.rowDescription")}
            detail={
              taxes.data
                ? t(`shop.taxes.calculation.${taxes.data.effectiveCalculation}`)
                : undefined
            }
            to="/commerce/settings/taxes"
          />
        </GroupedList>
        <GroupedList header={t("shop.settings.paymentsHeader")}>
          <GroupedListRow
            icon={CreditCard}
            label={t("shop.payments.title")}
            description={t("shop.payments.rowDescription")}
            accessory={
              payments.data &&
              (payments.data.connected ? (
                <Badge tone="success">
                  {payments.data.mode === "live"
                    ? t("shop.payments.live")
                    : t("shop.payments.testMode")}
                </Badge>
              ) : (
                <Badge tone="warning">{t("shop.payments.notConnected")}</Badge>
              ))
            }
            to="/commerce/settings/payments"
          />
          {canReadOutbox && (
            <GroupedListRow
              icon={Mail}
              iconTone="neutral"
              label={t("shop.emails.title")}
              description={t("shop.emails.rowDescription")}
              to="/users/emails"
            />
          )}
        </GroupedList>
      </div>
    </>
  );
}
