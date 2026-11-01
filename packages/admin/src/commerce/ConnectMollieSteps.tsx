import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { PasswordField } from "../design/PasswordField.js";
import { t } from "../i18n/strings.js";
import { ExternalButton, Step } from "./ConnectStep.js";
import type { PaymentProviders } from "./paymentProviders.api.js";
import { useConnectMollie, useDisconnectProvider } from "./paymentProviders.queries.js";

/**
 * "Connect Mollie" in two steps: make an account, paste the API key. Mollie is told where
 * the webhook is with every payment, so there's nothing to set up for it in Mollie.
 */
export function ConnectMollieSteps({
  mollie,
  canChange,
}: {
  mollie: PaymentProviders["mollie"];
  canChange: boolean;
}) {
  const [apiKey, setApiKey] = useState("");
  const save = useConnectMollie();
  const disconnect = useDisconnectProvider();

  return (
    <ol className="flex flex-col gap-6" aria-label={t("shop.mollie.stepsLabel")}>
      <Step number={1} title={t("shop.mollie.step1Title")} done={mollie.connected}>
        <p>{t("shop.mollie.step1Body")}</p>
        <ExternalButton href="https://my.mollie.com/dashboard/signup">
          {t("shop.mollie.step1Action")}
        </ExternalButton>
      </Step>
      <Step number={2} title={t("shop.mollie.step2Title")} done={mollie.connected}>
        <p>{t("shop.mollie.step2Body")}</p>
        <ExternalButton href="https://my.mollie.com/dashboard/developers/api-keys">
          {t("shop.mollie.step2Action")}
        </ExternalButton>
        {mollie.source === "environment" ? (
          <p>{t("shop.mollie.fromServer")}</p>
        ) : (
          canChange && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate(apiKey.trim(), { onSuccess: () => setApiKey("") });
              }}
            >
              <PasswordField
                label={t("shop.mollie.apiKeyLabel")}
                hint={
                  mollie.apiKeyHint
                    ? t("shop.paypal.savedHint", { hint: mollie.apiKeyHint })
                    : t("shop.mollie.apiKeyHint")
                }
                placeholder="test_…"
                value={apiKey}
                autoComplete="off"
                onChange={(event) => setApiKey(event.target.value)}
                error={save.error ? describeError(save.error) : undefined}
              />
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={save.isPending || !apiKey.trim()}>
                  {save.isPending ? t("shop.payments.checkingKey") : t("shop.mollie.save")}
                </Button>
                {mollie.source === "admin" && (
                  <Button variant="destructive" onClick={() => disconnect.mutate("mollie")}>
                    {t("shop.mollie.disconnect")}
                  </Button>
                )}
              </div>
            </form>
          )
        )}
        <p className="text-footnote text-label-secondary">
          {mollie.webhookUrl
            ? t("shop.mollie.webhookAutomatic", { url: mollie.webhookUrl })
            : t("shop.mollie.webhookLocal")}
        </p>
      </Step>
    </ol>
  );
}
