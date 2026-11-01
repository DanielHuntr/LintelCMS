import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { CopyButton } from "../design/CopyButton.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { DeliveryLog } from "./DeliveryLog.js";
import { webhookEventLabels } from "./webhooks.api.js";
import { useDeleteWebhook, useUpdateWebhook, useWebhook } from "./webhooks.queries.js";
import { WebhookFormDialog } from "./WebhookFormDialog.js";
import { Page } from "../design/Page.js";

/** /settings/webhooks/:id: one webhook's settings, its signing secret and its delivery log. */
export function WebhookDetailPage({ webhookId }: { webhookId: string }) {
  const webhook = useWebhook(webhookId);
  const update = useUpdateWebhook(webhookId);
  const deleteWebhook = useDeleteWebhook();
  const canChange = useCan("settings:update");
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showsSecret, setShowsSecret] = useState(false);
  const navigate = useNavigate();

  const back = <BackLink to="/settings/webhooks">{t("webhooks.title")}</BackLink>;
  if (webhook.isError) {
    return (
      <>
        {back}
        <LoadError error={webhook.error} onRetry={() => void webhook.refetch()} />
      </>
    );
  }
  if (!webhook.data) {
    return (
      <>
        {back}
        <LoadingRegion label={t("webhooks.loading")}>
          <Skeleton className="h-40 rounded-card" />
        </LoadingRegion>
      </>
    );
  }
  const current = webhook.data;

  return (
    <Page width="readable">
      {back}
      <LargeTitle
        title={current.name}
        subtitle={current.url}
        actions={
          canChange && (
            <>
              <Button
                variant="tinted"
                icon={<Pencil aria-hidden="true" strokeWidth={2} className="size-4" />}
                onClick={() => setIsEditing(true)}
              >
                {t("webhooks.edit")}
              </Button>
              <Button
                variant="destructive"
                icon={<Trash2 aria-hidden="true" strokeWidth={2} className="size-4" />}
                onClick={() => setIsDeleting(true)}
              >
                {t("webhooks.delete")}
              </Button>
            </>
          )
        }
      />
      <div className="flex flex-col gap-8">
        <GroupedList header={t("webhooks.settingsHeader")}>
          <GroupedListRow
            label={t("webhooks.sendEvents")}
            description={current.events.map((event) => t(webhookEventLabels[event])).join(", ")}
            wrapsText
            accessory={
              <Toggle
                label={t("webhooks.sendEvents")}
                labelVisibility="hidden"
                checked={current.enabled}
                disabled={!canChange || update.isPending}
                onCheckedChange={(enabled) => update.mutate({ enabled })}
              />
            }
          />
        </GroupedList>

        <GroupedList header={t("webhooks.secretHeader")} footer={t("webhooks.secretFooter")}>
          <GroupedListRow
            label={showsSecret ? current.secret : "whsec_••••••••••••••••"}
            accessory={
              <>
                <Button
                  variant="plain"
                  size="small"
                  aria-pressed={showsSecret}
                  icon={
                    showsSecret ? (
                      <EyeOff aria-hidden="true" strokeWidth={2} className="size-3.5" />
                    ) : (
                      <Eye aria-hidden="true" strokeWidth={2} className="size-3.5" />
                    )
                  }
                  onClick={() => setShowsSecret((shown) => !shown)}
                >
                  {t("webhooks.showSecret")}
                </Button>
                <CopyButton
                  value={current.secret}
                  label={t("webhooks.copySecret")}
                  variant="plain"
                />
              </>
            }
          />
        </GroupedList>

        <DeliveryLog webhookId={webhookId} canResend={canChange} />
      </div>

      {isEditing && (
        <WebhookFormDialog
          open
          title={t("webhooks.editTitle")}
          submitLabel={t("webhooks.save")}
          initialValues={{ name: current.name, url: current.url, events: current.events }}
          isSaving={update.isPending}
          error={update.error}
          onClose={() => {
            update.reset();
            setIsEditing(false);
          }}
          onSubmit={(values) => update.mutate(values, { onSuccess: () => setIsEditing(false) })}
        />
      )}
      <ConfirmDialog
        open={isDeleting}
        title={t("webhooks.deleteTitle", { name: current.name })}
        message={t("webhooks.deleteMessage")}
        confirmLabel={t("webhooks.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={deleteWebhook.isPending}
        onCancel={() => setIsDeleting(false)}
        onConfirm={() =>
          deleteWebhook.mutate(webhookId, {
            onSuccess: () => void navigate({ to: "/settings/webhooks" }),
          })
        }
      />
    </Page>
  );
}
