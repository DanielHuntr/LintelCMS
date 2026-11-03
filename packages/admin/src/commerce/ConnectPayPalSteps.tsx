import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { CopyButton } from "../design/CopyButton.js";
import { PasswordField } from "../design/PasswordField.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { ExternalButton, LocalWebhookNote, Step } from "./ConnectStep.js";
import type { PaymentProviders } from "./paymentProviders.api.js";
import { useConnectPayPal, useDisconnectProvider } from "./paymentProviders.queries.js";

const PAYPAL_APPS_PAGE = "https://developer.paypal.com/dashboard/applications/sandbox";

/**
 * "Connect PayPal" in three steps: make an app in PayPal's developer dashboard, add the
 * webhook, paste the app's details. They're checked with PayPal before they're saved.
 */
export function ConnectPayPalSteps({
  paypal,
  canChange,
  siteIsLocal,
}: {
  paypal: PaymentProviders["paypal"];
  canChange: boolean;
  siteIsLocal: boolean;
}) {
  const [environment, setEnvironment] = useState<"sandbox" | "live">(
    paypal.mode === "live" ? "live" : "sandbox",
  );
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookId, setWebhookId] = useState("");
  const save = useConnectPayPal();
  const disconnect = useDisconnectProvider();

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(
      {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        webhookId: webhookId.trim() || null,
        environment,
      },
      { onSuccess: () => setClientSecret("") },
    );
  }

  return (
    <ol className="flex flex-col gap-6" aria-label={t("shop.paypal.stepsLabel")}>
      <Step number={1} title={t("shop.paypal.step1Title")} done={paypal.clientIdHint !== null}>
        <p>{t("shop.paypal.step1Body")}</p>
        <ExternalButton href={PAYPAL_APPS_PAGE}>{t("shop.paypal.step1Action")}</ExternalButton>
      </Step>

      {!siteIsLocal && (
        <Step number={2} title={t("shop.paypal.step2Title")} done={paypal.webhookIdSet}>
          <p>{t("shop.paypal.step2Body")}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-control bg-fill px-3 py-2 text-footnote text-label">
              {paypal.webhookUrl}
            </code>
            <CopyButton value={paypal.webhookUrl} label={t("shop.payments.copyUrl")} />
          </div>
          <p className="text-footnote font-medium text-label">
            {t("shop.payments.eventsToChoose")}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {paypal.webhookEvents.map((event) => (
              <li key={event}>
                <code className="rounded-control bg-fill px-2 py-1 text-caption text-label">
                  {event}
                </code>
              </li>
            ))}
          </ul>
        </Step>
      )}

      <Step
        number={siteIsLocal ? 2 : 3}
        title={t("shop.paypal.step3Title")}
        done={paypal.connected}
      >
        {paypal.source === "environment" ? (
          <p>{t("shop.paypal.fromServer")}</p>
        ) : (
          canChange && (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <p>{siteIsLocal ? t("shop.paypal.step3BodyLocal") : t("shop.paypal.step3Body")}</p>
              <SegmentedControl<"sandbox" | "live">
                label={t("shop.paypal.environmentLabel")}
                value={environment}
                onChange={setEnvironment}
                options={[
                  { value: "sandbox", label: t("shop.paypal.sandbox") },
                  { value: "live", label: t("shop.paypal.live") },
                ]}
              />
              <TextField
                label={t("shop.paypal.clientIdLabel")}
                hint={
                  paypal.clientIdHint
                    ? t("shop.paypal.savedHint", { hint: paypal.clientIdHint })
                    : t("shop.paypal.clientIdHint")
                }
                value={clientId}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setClientId(event.target.value)}
              />
              <PasswordField
                label={t("shop.paypal.secretLabel")}
                hint={t("shop.paypal.secretHint")}
                value={clientSecret}
                autoComplete="off"
                onChange={(event) => setClientSecret(event.target.value)}
              />
              {!siteIsLocal && (
                <TextField
                  label={t("shop.paypal.webhookIdLabel")}
                  hint={t("shop.paypal.webhookIdHint")}
                  value={webhookId}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setWebhookId(event.target.value)}
                />
              )}
              {save.error && (
                <p role="alert" className="text-footnote text-danger">
                  {describeError(save.error)}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={save.isPending || !clientId.trim() || !clientSecret.trim()}
                >
                  {save.isPending ? t("shop.payments.checkingKey") : t("shop.paypal.save")}
                </Button>
                {paypal.source === "admin" && (
                  <Button variant="destructive" onClick={() => disconnect.mutate("paypal")}>
                    {t("shop.paypal.disconnect")}
                  </Button>
                )}
              </div>
            </form>
          )
        )}
      </Step>
      {siteIsLocal && <LocalWebhookNote providerName={t("shop.providers.name.paypal")} />}
    </ol>
  );
}
