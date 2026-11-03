import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { ConnectMollieSteps } from "./ConnectMollieSteps.js";
import { ConnectPayPalSteps } from "./ConnectPayPalSteps.js";
import { ConnectStripeSteps } from "./ConnectStripeSteps.js";
import { MarketPaymentProviders } from "./MarketPaymentProviders.js";
import type { PaymentProviderId, PaymentProviders } from "./paymentProviders.api.js";
import { usePaymentProviders } from "./paymentProviders.queries.js";
import type { PaymentSettings } from "./shopSettings.api.js";
import {
  useDisconnectStripe,
  usePaymentSettings,
  useSavePaymentKeys,
} from "./shopSettings.queries.js";
import { WaysToPay } from "./WaysToPay.js";

/**
 * /commerce/settings/payments: connecting Stripe, PayPal and Mollie, each step by step, and
 * which one each market's shoppers pay with.
 */
export function PaymentsPage() {
  const payments = usePaymentSettings();
  const providers = usePaymentProviders();
  const [provider, setProvider] = useState<PaymentProviderId>("stripe");
  const canChange = useCan("settings:update");
  const canChooseMarkets = useCan("commerce:update");
  return (
    <>
      <BackLink to="/commerce/settings">{t("shop.settings.title")}</BackLink>
      <LargeTitle
        title={t("shop.payments.title")}
        subtitle={t("shop.payments.subtitle")}
        actions={
          payments.data && <ConnectionBadge settings={payments.data} others={providers.data} />
        }
      />
      {payments.data && providers.data && (
        <div className="mb-6 flex max-w-2xl flex-col gap-6">
          <MarketPaymentProviders
            providers={providers.data}
            stripeConnected={payments.data.connected}
            canChange={canChooseMarkets}
          />
          <WaysToPay />
          <SegmentedControl<PaymentProviderId>
            label={t("shop.providers.chooseLabel")}
            value={provider}
            onChange={setProvider}
            options={[
              { value: "stripe", label: t("shop.providers.name.stripe") },
              { value: "paypal", label: t("shop.providers.name.paypal") },
              { value: "mollie", label: t("shop.providers.name.mollie") },
            ]}
          />
        </div>
      )}
      {provider === "paypal" && providers.data && (
        <div className="max-w-2xl">
          <ConnectPayPalSteps paypal={providers.data.paypal} canChange={canChange} />
        </div>
      )}
      {provider === "mollie" && providers.data && (
        <div className="max-w-2xl">
          <ConnectMollieSteps mollie={providers.data.mollie} canChange={canChange} />
        </div>
      )}
      {payments.isError && (
        <LoadError error={payments.error} onRetry={() => void payments.refetch()} />
      )}
      {payments.isPending && (
        <LoadingRegion label={t("shop.payments.loading")}>
          <Skeleton className="h-64 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {provider === "stripe" && payments.data && <Payments settings={payments.data} />}
    </>
  );
}

/** Whether the shop can take payments at all, with any provider, and whether for real. */
function ConnectionBadge({
  settings,
  others,
}: {
  settings: PaymentSettings;
  others: PaymentProviders | undefined;
}) {
  const connected = [
    settings.connected ? settings.mode : null,
    others?.paypal.connected ? others.paypal.mode : null,
    others?.mollie.connected ? others.mollie.mode : null,
  ].filter((mode) => mode !== null);
  if (connected.length === 0) {
    return <Badge tone="warning">{t("shop.payments.notConnected")}</Badge>;
  }
  const live = connected.includes("live");
  return (
    <Badge tone={live ? "success" : "accent"}>
      {live ? t("shop.payments.live") : t("shop.payments.testMode")}
    </Badge>
  );
}

function Payments({ settings }: { settings: PaymentSettings }) {
  const canChangeKeys = useCan("settings:update");
  const save = useSavePaymentKeys();
  const disconnect = useDisconnectStripe();
  const keysFromAdmin =
    settings.secretKey?.source === "admin" || settings.webhookSecret?.source === "admin";

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {settings.connected && (
        <Card>
          <div className="flex items-start gap-3">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="flex flex-col gap-1">
              <p className="text-headline text-label">{t("shop.payments.connectedTitle")}</p>
              <p className="text-body text-label-secondary">
                {settings.mode === "live"
                  ? t("shop.payments.connectedLive")
                  : t("shop.payments.connectedTest")}
              </p>
            </div>
          </div>
        </Card>
      )}

      <ConnectStripeSteps settings={settings} canChange={canChangeKeys} />

      <Card title={t("shop.payments.checkoutHeader")}>
        <div className="flex flex-col gap-3">
          <SegmentedControl<"hosted" | "embedded">
            label={t("shop.payments.checkoutHeader")}
            value={settings.checkoutMode}
            onChange={(checkoutMode) => save.mutate({ checkoutMode })}
            options={[
              { value: "hosted", label: t("shop.payments.hosted") },
              { value: "embedded", label: t("shop.payments.embedded") },
            ]}
          />
          <p className="text-footnote text-label-secondary">
            {settings.checkoutMode === "hosted"
              ? t("shop.payments.hostedHint")
              : t("shop.payments.embeddedHint")}
          </p>
          <p className="text-footnote text-label-secondary">{t("shop.payments.cardSafety")}</p>
        </div>
      </Card>

      {canChangeKeys && keysFromAdmin && (
        <div>
          <Button
            variant="destructive"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            {t("shop.payments.disconnect")}
          </Button>
        </div>
      )}
    </div>
  );
}
