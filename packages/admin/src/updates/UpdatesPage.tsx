import { CircleCheck, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AvailableUpdate, OtherVersions } from "./AvailableUpdate.js";
import { RollbackDialog, UpdateConfirmDialog } from "./UpdateDialogs.js";
import { UpdateMethodCard } from "./UpdateMethodCard.js";
import { UpdateProgressPanel } from "./UpdateProgressPanel.js";
import { ChannelCard, EarlierVersionsCard, PluginUpdatesCard } from "./UpdateSettingsCards.js";
import type { InstalledVersion, UpdatesOverview } from "./updates.api.js";
import {
  useCheckForUpdates,
  useInstallUpdate,
  useRollBack,
  useSaveUpdateChannel,
  useUpdateProgress,
  useUpdates,
} from "./updates.queries.js";

const RECENT = 60 * 60_000;

/**
 * /settings/updates: whether there is a new version, what changes in plain words, and the
 * one way this copy of Lintel is updated: the big button, or the commands to run.
 */
export function UpdatesPage() {
  const updates = useUpdates();
  const check = useCheckForUpdates();

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle
        title={t("updates.title")}
        subtitle={
          updates.data ? t("updates.subtitle", { version: updates.data.currentVersion }) : undefined
        }
        actions={
          updates.data?.checksEnabled && (
            <Button
              variant="tinted"
              icon={
                <RefreshCw
                  aria-hidden="true"
                  className={check.isPending ? "motion-safe:animate-spin" : ""}
                />
              }
              onClick={() => check.mutate()}
              disabled={check.isPending}
            >
              {check.isPending ? t("updates.checking") : t("updates.checkNow")}
            </Button>
          )
        }
      />
      {check.isError && (
        <p role="alert" className="mb-4 max-w-2xl text-footnote text-danger">
          {describeError(check.error)}
        </p>
      )}
      {updates.isError && (
        <LoadError error={updates.error} onRetry={() => void updates.refetch()} />
      )}
      {updates.isPending && (
        <LoadingRegion label={t("updates.loading")}>
          <Skeleton className="h-64 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {updates.data && <UpdatesContent overview={updates.data} />}
    </>
  );
}

function UpdatesContent({ overview }: { overview: UpdatesOverview }) {
  const canChangeChannel = useCan("settings:update");
  const now = useNow();
  const install = useInstallUpdate();
  const rollBack = useRollBack();
  const saveChannel = useSaveUpdateChannel();
  const [confirming, setConfirming] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<InstalledVersion | null>(null);
  const underWay = overview.progress !== null && overview.progress.finishedAt === null;
  const { progress, restarting, signedOut } = useUpdateProgress(
    install.data ?? rollBack.data ?? overview.progress,
    underWay || install.isSuccess || rollBack.isSuccess,
  );

  const recommended = overview.releases.find(
    (release) => release.version === overview.recommendedVersion,
  );
  const others = overview.releases.filter((release) => release !== recommended);
  const canUpdate = overview.canInstall && overview.method.oneClick && !underWay;
  const noButtonReason = !overview.canInstall ? t("updates.ownersOnly") : null;
  // How the last update ended stays on screen for an hour, then it's old news.
  const showProgress =
    progress !== null &&
    (progress.finishedAt === null || now - Date.parse(progress.finishedAt) < RECENT);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <CheckStatus overview={overview} />
      {showProgress && progress && (
        <UpdateProgressPanel progress={progress} restarting={restarting} signedOut={signedOut} />
      )}

      {recommended ? (
        <AvailableUpdate
          release={recommended}
          currentVersion={overview.currentVersion}
          canUpdate={canUpdate}
          noButtonReason={noButtonReason}
          isStarting={install.isPending}
          onUpdate={() => setConfirming(true)}
        />
      ) : (
        <div className="rounded-card bg-surface">
          <EmptyState
            icon={CircleCheck}
            title={t("updates.upToDateTitle")}
            description={t("updates.upToDateText", { version: overview.currentVersion })}
          />
        </div>
      )}
      <OtherVersions releases={others} />
      <UpdateMethodCard
        method={overview.method}
        version={recommended?.version ?? overview.currentVersion}
      />
      <PluginUpdatesCard plugins={overview.plugins} />
      <EarlierVersionsCard
        versions={overview.installedVersions}
        canRollBack={overview.canInstall && overview.method.oneClick && !underWay}
        onRollBack={setRollbackTarget}
      />
      <ChannelCard
        channel={overview.preferences.channel}
        canChange={canChangeChannel}
        onChange={(channel) => saveChannel.mutate(channel)}
      />

      {recommended && (
        <UpdateConfirmDialog
          open={confirming}
          version={recommended.version}
          currentVersion={overview.currentVersion}
          isWorking={install.isPending}
          error={install.error}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            install.mutate(recommended.version, { onSuccess: () => setConfirming(false) })
          }
        />
      )}
      <RollbackDialog
        target={rollbackTarget}
        isWorking={rollBack.isPending}
        error={rollBack.error}
        onCancel={() => setRollbackTarget(null)}
        onConfirm={(restoreBackup) =>
          rollbackTarget &&
          rollBack.mutate(
            { version: rollbackTarget.version, restoreBackup },
            { onSuccess: () => setRollbackTarget(null) },
          )
        }
      />
    </div>
  );
}

/** When Lintel last looked, why it couldn't, or that it doesn't look at all. */
function CheckStatus({ overview }: { overview: UpdatesOverview }) {
  const now = useNow();
  if (!overview.checksEnabled) {
    return <p className="text-footnote text-label-secondary">{t("updates.checksOff")}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {overview.problem && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-control bg-warning/12 px-3 py-2 text-footnote text-label"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          {overview.problem}
        </p>
      )}
      <p className="text-footnote text-label-secondary">
        {overview.checkedAt
          ? t("updates.lastChecked", { when: formatRelativeTime(overview.checkedAt, now) })
          : t("updates.neverChecked")}
        {!overview.feedIsDefault && ` ${t("updates.customFeed")}`}
      </p>
    </div>
  );
}
