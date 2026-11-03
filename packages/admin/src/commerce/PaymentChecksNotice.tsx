import { TriangleAlert } from "lucide-react";
import { t } from "../i18n/strings.js";
import type { PaymentProviders } from "./paymentProviders.api.js";
import type { PaymentSettings } from "./shopSettings.api.js";

/**
 * Plain facts about how payments reach this shop: which providers Lintel checks with itself,
 * which are on test keys, and a warning when a live site still is.
 */
export function PaymentChecksNotice({
  settings,
  providers,
}: {
  settings: PaymentSettings;
  providers: PaymentProviders;
}) {
  const connected = [
    {
      name: t("shop.providers.name.stripe"),
      hasKeys: settings.secretKey !== null,
      mode: settings.mode,
      checks: settings.checksForPayments,
    },
    {
      name: t("shop.providers.name.paypal"),
      hasKeys: providers.paypal.clientIdHint !== null,
      mode: providers.paypal.mode,
      checks: providers.paypal.checksForPayments,
    },
    {
      name: t("shop.providers.name.mollie"),
      hasKeys: providers.mollie.apiKeyHint !== null,
      mode: providers.mollie.mode,
      checks: providers.mollie.checksForPayments,
    },
  ].filter((provider) => provider.hasKeys);
  if (connected.length === 0) return null;

  const notes = connected.flatMap(({ name, mode, checks }) => [
    ...(checks
      ? [
          t(settings.siteIsLocal ? "shop.checks.onComputer" : "shop.checks.noWebhookYet", {
            provider: name,
          }),
        ]
      : []),
    ...(mode === "test" && settings.siteIsLocal
      ? [t("shop.checks.testKeys", { provider: name })]
      : []),
  ]);
  const warnings = settings.siteIsLocal
    ? []
    : connected
        .filter(({ mode }) => mode === "test")
        .map(({ name }) => t("shop.checks.liveOnTestKeys", { provider: name }));

  return (
    <div className="flex flex-col gap-2">
      {warnings.map((warning) => (
        <p
          key={warning}
          role="alert"
          className="flex items-start gap-2 rounded-control bg-warning/12 px-3 py-2 text-footnote text-label"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>{warning}</span>
        </p>
      ))}
      {notes.map((note) => (
        <p key={note} className="text-footnote text-label-secondary">
          {note}
        </p>
      ))}
    </div>
  );
}
