import { Badge } from "../design/Badge.js";
import { Card } from "../design/Card.js";
import { Skeleton } from "../design/Skeleton.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { t } from "../i18n/strings.js";
import { useNow } from "../content/useNow.js";
import { ExternalButton } from "./ConnectStep.js";
import type { ProviderWaysToPay, WayToPay } from "./paymentProviders.api.js";
import { useWaysToPay } from "./paymentProviders.queries.js";
import type { PaymentSettings } from "./shopSettings.api.js";
import { usePaymentSettings } from "./shopSettings.queries.js";

/** Shown one at a time, the first one the shop doesn't have yet. */
const SUGGESTED_METHODS: Record<string, Array<{ id: string; name: string }>> = {
  stripe: [
    { id: "klarna", name: "Klarna" },
    { id: "afterpay_clearpay", name: "Clearpay" },
    { id: "ideal", name: "iDEAL" },
  ],
  mollie: [
    { id: "klarna", name: "Klarna" },
    { id: "ideal", name: "iDEAL" },
  ],
};

/**
 * "Ways to pay": what each connected provider says shoppers can pay with, and where to change
 * it. Lintel doesn't choose methods, the provider does, so this only reports. When a provider
 * can't say, it says so instead of guessing. Nothing shows until a provider is connected: the
 * steps further down the page come first.
 */
export function WaysToPay() {
  const settings = usePaymentSettings();
  const ways = useWaysToPay(settings.data?.secretKey?.hint);
  if (ways.isPending) {
    return <Skeleton className="h-40 rounded-card" />;
  }
  const providers = ways.data?.providers ?? [];
  if (ways.isError || providers.length === 0) return null;

  return (
    <Card title={t("shop.waysToPay.title")}>
      <div className="flex flex-col gap-5">
        {providers.map((provider) => (
          <ProviderWays key={provider.provider} ways={provider} settings={settings.data} />
        ))}
        <p className="text-footnote text-label-secondary">{t("shop.waysToPay.availability")}</p>
      </div>
    </Card>
  );
}

function ProviderWays({
  ways,
  settings,
}: {
  ways: ProviderWaysToPay;
  settings: PaymentSettings | undefined;
}) {
  const name = t(`shop.providers.name.${ways.provider}`);
  const link = settingsLink(ways);
  const suggestion = SUGGESTED_METHODS[ways.provider]?.find(
    (method) => !ways.methods?.some((way) => way.id === method.id),
  );
  return (
    <section className="flex flex-col gap-2" aria-label={name}>
      <div className="flex items-center gap-2">
        <h3 className="text-body font-medium text-label">{name}</h3>
        {ways.mode === "test" && <Badge tone="accent">{t("shop.payments.testMode")}</Badge>}
      </div>
      {ways.methods ? (
        <MethodList methods={ways.methods} />
      ) : (
        <p className="text-body text-label-secondary">
          {ways.provider === "paypal"
            ? t("shop.waysToPay.paypal")
            : t("shop.waysToPay.unknown", { name })}
        </p>
      )}
      {ways.mode === "test" && ways.methods && (
        <p className="text-footnote text-label-secondary">
          {t("shop.waysToPay.testNote", { name })}
        </p>
      )}
      {ways.methods && suggestion && (
        <p className="text-footnote text-label-secondary">
          {t("shop.waysToPay.suggestion", { method: suggestion.name, name })}
        </p>
      )}
      {ways.provider === "stripe" && settings && <LastStripeMessage settings={settings} />}
      {link && <ExternalButton href={link.href}>{link.label}</ExternalButton>}
    </section>
  );
}

function MethodList({ methods }: { methods: WayToPay[] }) {
  if (methods.length === 0) {
    return <p className="text-body text-label-secondary">{t("shop.waysToPay.none")}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {methods.map((method) => (
        <li key={method.id}>
          <Badge tone={method.waiting ? "warning" : "neutral"}>
            {method.waiting ? t("shop.waysToPay.waiting", { method: method.name }) : method.name}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/**
 * Whether Stripe's messages are reaching the shop, which is how orders get made. Only for a
 * shop with a webhook set up. `lastWebhookAt` is empty until a message arrives after the
 * signing secret was saved; a server too old to send it shows nothing.
 */
function LastStripeMessage({ settings }: { settings: PaymentSettings }) {
  const now = useNow();
  if (!settings.webhookSecret || settings.lastWebhookAt === undefined) return null;
  return (
    <p className="text-footnote text-label-secondary">
      {settings.lastWebhookAt === null
        ? t("shop.waysToPay.noMessage")
        : t("shop.waysToPay.lastMessage", {
            time: formatRelativeTime(settings.lastWebhookAt, now),
          })}
    </p>
  );
}

function settingsLink(ways: ProviderWaysToPay): { href: string; label: string } | null {
  if (ways.provider === "stripe") {
    return {
      href: `https://dashboard.stripe.com/${ways.mode === "test" ? "test/" : ""}settings/payment_methods`,
      label: t("shop.waysToPay.openStripe"),
    };
  }
  if (ways.provider === "mollie") {
    return { href: "https://my.mollie.com/dashboard", label: t("shop.waysToPay.openMollie") };
  }
  return null;
}
