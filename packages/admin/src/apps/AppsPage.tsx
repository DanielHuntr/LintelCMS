import { AppWindow, Plus } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, tCount } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AddAppDialog } from "./AddAppDialog.js";
import type { AppResponse } from "./apps.api.js";
import { useApps } from "./apps.queries.js";

/**
 * /settings/apps: the apps installed on this site, and adding one. Each row opens the app's
 * page, with what it may do and the button to uninstall it.
 */
export function AppsPage() {
  const apps = useApps();
  const canChange = useCan("settings:update");
  const [isAdding, setIsAdding] = useState(false);
  const now = useNow();

  const addButton = canChange && (
    <Button
      variant="tinted"
      size="small"
      icon={<Plus aria-hidden="true" strokeWidth={2.25} className="size-3.5" />}
      onClick={() => setIsAdding(true)}
    >
      {t("apps.addApp")}
    </Button>
  );

  function describe(app: AppResponse): string {
    const access = tCount(
      { one: "apps.list.scopesOne", other: "apps.list.scopesOther" },
      app.scopes.length,
    );
    const used = app.lastUsedAt
      ? t("apps.list.lastUsed", { when: formatRelativeTime(app.lastUsedAt, now) })
      : t("apps.list.neverUsed");
    return `${access} · ${used}`;
  }

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle
        title={t("apps.title")}
        subtitle={t("apps.subtitle")}
        actions={apps.data && apps.data.length > 0 ? addButton : undefined}
      />
      <div className="flex max-w-2xl flex-col gap-8">
        {apps.isError && <LoadError error={apps.error} onRetry={() => void apps.refetch()} />}
        {apps.isPending && (
          <LoadingRegion label={t("apps.loading")}>
            <Skeleton className="h-14 rounded-card" />
          </LoadingRegion>
        )}
        {apps.data?.length === 0 && (
          <div className="rounded-card bg-surface">
            <EmptyState
              icon={AppWindow}
              title={t("apps.emptyTitle")}
              description={t("apps.emptyDescription")}
              action={addButton}
            />
          </div>
        )}
        {apps.data && apps.data.length > 0 && (
          <GroupedList footer={t("apps.listFooter")}>
            {apps.data.map((app) => (
              <GroupedListRow
                key={app.id}
                icon={AppWindow}
                iconTone="success"
                label={app.name}
                description={describe(app)}
                to={`/settings/apps/${app.id}`}
              />
            ))}
          </GroupedList>
        )}
      </div>
      <AddAppDialog open={isAdding} onClose={() => setIsAdding(false)} />
    </>
  );
}
