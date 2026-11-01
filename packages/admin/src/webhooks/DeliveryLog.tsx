import { RotateCw, ScrollText } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { formatDateTime, formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, tCount } from "../i18n/strings.js";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge.js";
import { webhookEventLabels, type WebhookDelivery } from "./webhooks.api.js";
import { useResendDelivery, useWebhookDeliveries } from "./webhooks.queries.js";

interface DeliveryLogProps {
  webhookId: string;
  canResend: boolean;
}

/** Every event sent to the webhook, newest first, with what the receiver answered. */
export function DeliveryLog({ webhookId, canResend }: DeliveryLogProps) {
  const deliveries = useWebhookDeliveries(webhookId);
  const resend = useResendDelivery(webhookId);
  const now = useNow();

  return (
    <section aria-labelledby="delivery-log-heading" className="flex flex-col gap-2">
      <h2 id="delivery-log-heading" className="px-4 text-headline text-label">
        {t("webhooks.logHeader")}
      </h2>
      {deliveries.isError && (
        <LoadError error={deliveries.error} onRetry={() => void deliveries.refetch()} />
      )}
      {deliveries.isPending && (
        <LoadingRegion label={t("webhooks.logLoading")}>
          <Skeleton className="h-14 rounded-card" />
        </LoadingRegion>
      )}
      {deliveries.data?.deliveries.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            icon={ScrollText}
            title={t("webhooks.logEmptyTitle")}
            description={t("webhooks.logEmptyDescription")}
          />
        </div>
      )}
      {deliveries.data && deliveries.data.deliveries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {deliveries.data.deliveries.map((delivery) => (
            <li key={delivery.id}>
              <DeliveryRow
                delivery={delivery}
                now={now}
                canResend={canResend}
                isResending={resend.isPending && resend.variables === delivery.id}
                onResend={() => resend.mutate(delivery.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface DeliveryRowProps {
  delivery: WebhookDelivery;
  now: number;
  canResend: boolean;
  isResending: boolean;
  onResend: () => void;
}

function DeliveryRow({ delivery, now, canResend, isResending, onResend }: DeliveryRowProps) {
  return (
    <details className="rounded-card bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-card px-4 py-3 focus-visible:focus-ring">
        <DeliveryStatusBadge status={delivery.status} />
        <span className="min-w-0 flex-1 truncate text-body text-label">
          {t(webhookEventLabels[delivery.event])}
        </span>
        <time
          dateTime={delivery.createdAt}
          title={formatDateTime(delivery.createdAt)}
          className="text-footnote text-label-secondary"
        >
          {formatRelativeTime(delivery.createdAt, now)}
        </time>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4 text-footnote text-label">
        <p className="text-label-secondary">{describeOutcome(delivery, now)}</p>
        {delivery.responseSummary && (
          <div className="flex flex-col gap-1">
            <p className="font-medium">{t("webhooks.response")}</p>
            <pre className="max-h-32 overflow-auto rounded-control bg-fill p-2 font-mono whitespace-pre-wrap">
              {delivery.responseSummary}
            </pre>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t("webhooks.payload")}</p>
          <pre className="max-h-48 overflow-auto rounded-control bg-fill p-2 font-mono">
            {JSON.stringify(delivery.payload, null, 2)}
          </pre>
        </div>
        {canResend && (
          <Button
            variant="tinted"
            size="small"
            className="self-start"
            disabled={isResending}
            icon={<RotateCw aria-hidden="true" strokeWidth={2} className="size-3.5" />}
            onClick={onResend}
          >
            {isResending ? t("webhooks.resending") : t("webhooks.resend")}
          </Button>
        )}
      </div>
    </details>
  );
}

function describeOutcome(delivery: WebhookDelivery, now: number): string {
  const attempts = tCount(
    { one: "webhooks.attempts.one", other: "webhooks.attempts.other" },
    delivery.attemptCount,
  );
  if (delivery.status === "delivered") {
    return t("webhooks.outcome.delivered", { status: delivery.responseStatus ?? "", attempts });
  }
  if (delivery.status === "failed") {
    return t("webhooks.outcome.failed", { attempts });
  }
  if (delivery.attemptCount === 0 || !delivery.nextAttemptAt) {
    return t("webhooks.outcome.waiting");
  }
  return t("webhooks.outcome.retrying", {
    attempts,
    when: formatRelativeTime(delivery.nextAttemptAt, now),
  });
}
