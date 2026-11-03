import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { CopyButton } from "../design/CopyButton.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AppAccessSummary } from "./AppAccessSummary.js";
import { AppIcon } from "./AppIcon.js";
import { useApp, useUninstallApp } from "./apps.queries.js";

/**
 * /build/apps/$appId: one installed app. What it may do (the same words as when it was
 * installed), its client id, who installed it, and uninstalling it, which takes back all of
 * its access at once.
 */
export function AppDetailPage({ appId }: { appId: string }) {
  const app = useApp(appId);
  const uninstall = useUninstallApp();
  const canChange = useCan("settings:update");
  const navigate = useNavigate();
  const now = useNow();
  const [isConfirming, setIsConfirming] = useState(false);

  if (app.isError) {
    return (
      <>
        <BackLink to="/build/apps">{t("apps.title")}</BackLink>
        <LoadError error={app.error} onRetry={() => void app.refetch()} />
      </>
    );
  }
  if (app.isPending) {
    return (
      <LoadingRegion label={t("apps.loading")}>
        <Skeleton className="h-40 rounded-card" />
      </LoadingRegion>
    );
  }

  const { manifest } = app.data;
  const installedWhen = formatRelativeTime(app.data.installedAt, now);

  return (
    <>
      <BackLink to="/build/apps">{t("apps.title")}</BackLink>
      <LargeTitle
        title={app.data.name}
        subtitle={manifest.description}
        actions={
          canChange && (
            <Button
              variant="tinted"
              size="small"
              icon={<Trash2 aria-hidden="true" strokeWidth={2} className="size-3.5" />}
              onClick={() => setIsConfirming(true)}
            >
              {t("apps.uninstall")}
            </Button>
          )
        }
      />
      <div className="flex max-w-2xl flex-col gap-8">
        <Card>
          <div className="mb-5 flex items-center gap-3">
            <AppIcon iconUrl={manifest.icon ?? null} size="large" />
            <p className="text-footnote text-label-secondary">
              {manifest.developer
                ? t("apps.review.madeBy", { developer: manifest.developer.name })
                : t("apps.review.from", { origin: new URL(manifest.appUrl).host })}
            </p>
          </div>
          <AppAccessSummary manifest={manifest} />
        </Card>

        <GroupedList
          header={t("apps.detail.credentialHeader")}
          footer={t("apps.detail.credentialFooter")}
        >
          <GroupedListRow
            label={t("apps.clientId")}
            description={app.data.clientId}
            accessory={
              <CopyButton
                value={app.data.clientId}
                label={t("apps.copy", { what: t("apps.clientId") })}
                variant="plain"
              />
            }
          />
          <GroupedListRow
            label={t("apps.clientSecret")}
            description={t("apps.detail.secretHidden")}
            detail={`${app.data.clientSecretStart}…`}
          />
        </GroupedList>

        <GroupedList header={t("apps.detail.aboutHeader")}>
          <GroupedListRow
            label={t("apps.detail.installed")}
            detail={
              app.data.installedBy
                ? t("apps.detail.installedBy", {
                    when: installedWhen,
                    name: app.data.installedBy.name,
                  })
                : installedWhen
            }
          />
          <GroupedListRow
            label={t("apps.detail.lastUsed")}
            detail={
              app.data.lastUsedAt
                ? formatRelativeTime(app.data.lastUsedAt, now)
                : t("apps.list.neverUsed")
            }
          />
          <GroupedListRow label={t("apps.detail.address")} detail={new URL(manifest.appUrl).host} />
        </GroupedList>
      </div>

      <ConfirmDialog
        open={isConfirming}
        title={t("apps.uninstallTitle", { name: app.data.name })}
        message={t("apps.uninstallMessage")}
        confirmLabel={t("apps.uninstallConfirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={uninstall.isPending}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() =>
          uninstall.mutate(appId, {
            onSuccess: () => void navigate({ to: "/build/apps" }),
          })
        }
      />
    </>
  );
}
