import { CircleCheck } from "lucide-react";
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
import { ConnectStripeSteps } from "./ConnectStripeSteps.js";
import type { PaymentSettings } from "./shopSettings.api.js";
import {
  useDisconnectStripe,
  usePaymentSettings,
  useSavePaymentKeys,
} from "./shopSettings.queries.js";

/** /commerce/settings/payments: connecting Stripe, step by step, and how shoppers pay. */
export function PaymentsPage() {
  const payments = usePaymentSettings();
  return (
    <>
      <BackLink to="/commerce/settings">{t("shop.settings.title")}</BackLink>
      <LargeTitle
        title={t("shop.payments.title")}
        subtitle={t("shop.payments.subtitle")}
        actions={payments.data && <ConnectionBadge settings={payments.data} />}
      />
      {payments.isError && (
        <LoadError error={payments.error} onRetry={() => void payments.refetch()} />
      )}
      {payments.isPending && (
        <LoadingRegion label={t("shop.payments.loading")}>
          <Skeleton className="h-64 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {payments.data && <Payments settings={payments.data} />}
    </>
  );
}

function ConnectionBadge({ settings }: { settings: PaymentSettings }) {
  if (!settings.connected) return <Badge tone="warning">{t("shop.payments.notConnected")}</Badge>;
  return (
    <Badge tone={settings.mode === "live" ? "success" : "accent"}>
      {settings.mode === "live" ? t("shop.payments.live") : t("shop.payments.testMode")}
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
