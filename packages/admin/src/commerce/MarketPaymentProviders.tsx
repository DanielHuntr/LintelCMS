import { describeError } from "../api/describeError.js";
import { Card } from "../design/Card.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import type { PaymentProviderId, PaymentProviders } from "./paymentProviders.api.js";
import { useChooseMarketProvider } from "./paymentProviders.queries.js";

/** Which provider each market's shoppers pay with. Only connected ones can be chosen. */
export function MarketPaymentProviders({
  providers,
  stripeConnected,
  canChange,
}: {
  providers: PaymentProviders;
  stripeConnected: boolean;
  canChange: boolean;
}) {
  const choose = useChooseMarketProvider();
  const connected: Record<PaymentProviderId, boolean> = {
    stripe: stripeConnected,
    paypal: providers.paypal.connected,
    mollie: providers.mollie.connected,
  };
  if (providers.markets.length === 0) return null;

  return (
    <Card title={t("shop.providers.marketsHeader")}>
      <p className="mb-4 text-body text-label-secondary">{t("shop.providers.marketsBody")}</p>
      <ul className="flex flex-col gap-4">
        {providers.markets.map((market) => {
          const id = `market-provider-${market.id}`;
          return (
            <li key={market.id} className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor={id} className="text-body text-label">
                {market.name} · {market.currency}
              </label>
              <select
                id={id}
                value={market.paymentProvider}
                disabled={!canChange || choose.isPending}
                onChange={(event) =>
                  choose.mutate({
                    marketId: market.id,
                    provider: event.target.value as PaymentProviderId,
                  })
                }
                className={`${controlClasses()} h-9 w-48`}
              >
                {(["stripe", "paypal", "mollie"] as const).map((provider) => (
                  <option
                    key={provider}
                    value={provider}
                    disabled={!connected[provider] && provider !== market.paymentProvider}
                  >
                    {connected[provider]
                      ? t(`shop.providers.name.${provider}`)
                      : t("shop.providers.notConnectedOption", {
                          name: t(`shop.providers.name.${provider}`),
                        })}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      {choose.error && (
        <p role="alert" className="mt-3 text-footnote text-danger">
          {describeError(choose.error)}
        </p>
      )}
    </Card>
  );
}
