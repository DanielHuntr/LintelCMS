import { useNavigate } from "@tanstack/react-router";
import { Plus, Webhook as WebhookIcon } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, tCount } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge.js";
import { useCreateWebhook, useWebhooks } from "./webhooks.queries.js";
import { WebhookFormDialog } from "./WebhookFormDialog.js";

/** /settings/webhooks: the addresses Lintel tells when content changes. */
export function WebhooksPage() {
  const webhooks = useWebhooks();
  const createWebhook = useCreateWebhook();
  const canChange = useCan("settings:update");
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();

  const addButton = canChange && (
    <Button icon={<Plus aria-hidden="true" />} onClick={() => setIsAdding(true)}>
      {t("webhooks.add")}
    </Button>
  );

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle
        title={t("webhooks.title")}
        subtitle={t("webhooks.subtitle")}
        actions={webhooks.data?.length === 0 ? undefined : addButton}
      />

      {webhooks.isError && (
        <LoadError error={webhooks.error} onRetry={() => void webhooks.refetch()} />
      )}
      {webhooks.isPending && (
        <LoadingRegion label={t("webhooks.loading")}>
          <Skeleton className="h-14 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {webhooks.data?.length === 0 && (
        <div className="max-w-2xl rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={WebhookIcon}
            title={t("webhooks.emptyTitle")}
            description={t("webhooks.emptyDescription")}
            action={addButton}
          />
        </div>
      )}
      {webhooks.data && webhooks.data.length > 0 && (
        <div className="max-w-2xl">
          <GroupedList footer={t("webhooks.footer")}>
            {webhooks.data.map((webhook) => (
              <GroupedListRow
                key={webhook.id}
                icon={WebhookIcon}
                iconTone={webhook.enabled ? "accent" : "neutral"}
                label={webhook.name}
                description={`${webhook.url} · ${tCount(
                  { one: "webhooks.eventCount.one", other: "webhooks.eventCount.other" },
                  webhook.events.length,
                )}`}
                accessory={
                  webhook.enabled ? (
                    webhook.lastDelivery && (
                      <DeliveryStatusBadge status={webhook.lastDelivery.status} />
                    )
                  ) : (
                    <Badge tone="neutral">{t("webhooks.off")}</Badge>
                  )
                }
                to={`/settings/webhooks/${encodeURIComponent(webhook.id)}`}
              />
            ))}
          </GroupedList>
        </div>
      )}

      {isAdding && (
        <WebhookFormDialog
          open
          title={t("webhooks.addTitle")}
          submitLabel={t("webhooks.add")}
          isSaving={createWebhook.isPending}
          error={createWebhook.error}
          onClose={() => {
            createWebhook.reset();
            setIsAdding(false);
          }}
          onSubmit={(values) =>
            createWebhook.mutate(values, {
              onSuccess: (webhook) =>
                void navigate({
                  to: "/settings/webhooks/$webhookId",
                  params: { webhookId: webhook.id },
                }),
            })
          }
        />
      )}
    </>
  );
}
