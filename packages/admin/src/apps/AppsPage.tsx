import { AppWindow, Plus, TriangleAlert, Wrench } from "lucide-react";
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
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AddAppDialog } from "./AddAppDialog.js";
import type { AppResponse } from "./apps.api.js";
import { useAppDevelopmentMode, useApps, useSetAppDevelopmentMode } from "./apps.queries.js";

/**
 * /build/apps: the apps installed on this site, and adding one. Each row opens the app's
 * page, with what it may do and the button to uninstall it. Apps sit beside Build →
 * Add-ons: an add-on runs inside Lintel with full access, an app on its own server with
 * only the scopes it was given. Development mode, for building an app on this computer,
 * is at the bottom, and only where the server allows it.
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
    const count = app.scopes.length;
    const access = count === 1 ? t("apps.list.scopesOne") : t("apps.list.scopesOther", { count });
    const used = app.lastUsedAt
      ? t("apps.list.lastUsed", { when: formatRelativeTime(app.lastUsedAt, now) })
      : t("apps.list.neverUsed");
    return `${access} · ${used}`;
  }

  return (
    <Page width="readable">
      <BackLink to="/build">{t("nav.build")}</BackLink>
      <LargeTitle
        title={t("apps.title")}
        subtitle={t("apps.subtitle")}
        actions={apps.data && apps.data.length > 0 ? addButton : undefined}
      />
      <div className="flex flex-col gap-8">
        <DevelopmentModeNotice />
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
                to={`/build/apps/${app.id}`}
              />
            ))}
          </GroupedList>
        )}
        {canChange && <DevelopmentModeSwitch />}
      </div>
      <AddAppDialog open={isAdding} onClose={() => setIsAdding(false)} />
    </Page>
  );
}

/** Says, for as long as it is on, that apps on this computer can be installed. */
function DevelopmentModeNotice() {
  const mode = useAppDevelopmentMode();
  if (!mode.data?.on) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2.5 rounded-card bg-surface px-4 py-3 text-body text-label"
    >
      <TriangleAlert
        aria-hidden="true"
        strokeWidth={2}
        className="mt-0.5 size-4 shrink-0 text-warning"
      />
      {t("apps.development.onNotice")}
    </p>
  );
}

/** The switch, shown only on servers that allow development mode (APPS_DEVELOPMENT_MODE). */
function DevelopmentModeSwitch() {
  const mode = useAppDevelopmentMode();
  const setMode = useSetAppDevelopmentMode();
  if (!mode.data?.available) return null;
  return (
    <GroupedList header={t("apps.development.header")} footer={t("apps.development.footer")}>
      <GroupedListRow
        icon={Wrench}
        iconTone="neutral"
        label={t("apps.development.label")}
        accessory={
          <Toggle
            label={t("apps.development.label")}
            labelVisibility="hidden"
            checked={mode.data.on}
            disabled={setMode.isPending}
            onCheckedChange={(on) => setMode.mutate(on)}
          />
        }
      />
    </GroupedList>
  );
}
