import { Check, Download, Pencil, Plug, Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { formatDateTime } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";
import { useSession } from "../session/SessionContext.js";
import { type PublishRun, type PublishTarget, zipDownloadUrl } from "./publishing.api.js";
import {
  useDeletePublishTarget,
  usePublishRun,
  usePublishRuns,
  usePublishWebsite,
  useTestPublishTarget,
  useUpdatePublishTarget,
} from "./publishing.queries.js";
import { PublishTargetDialog } from "./PublishTargetDialog.js";
import { PublishHistory } from "./PublishHistory.js";

/** One destination: what works there, the buttons to test and publish, and its history. */
export function PublishTargetCard({
  target,
  canChange,
}: {
  target: PublishTarget;
  canChange: boolean;
}) {
  const test = useTestPublishTarget(target.id);
  const publish = usePublishWebsite(target.id);
  const update = useUpdatePublishTarget(target.id);
  const remove = useDeletePublishTarget();
  const runs = usePublishRuns(target.id);
  const [runId, setRunId] = useState<string | null>(null);
  const run = usePublishRun(target.id, runId);
  const [isEditing, setIsEditing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const current = run.data ?? null;
  const isRunning = publish.isPending || current?.status === "running";
  const waitingRun = runs.data?.find(
    (candidate) => candidate.status === "needsConfirmation" && candidate.id === runs.data?.[0]?.id,
  );

  const startPublish = (confirmDeletions = false) =>
    publish.mutate({ confirmDeletions }, { onSuccess: (started) => setRunId(started.id) });

  async function download() {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch(zipDownloadUrl(target.id), { credentials: "include" });
      if (!response.ok)
        throw new Error(
          ((await response.json()) as { message?: string }).message ?? response.statusText,
        );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await response.blob());
      link.download = "website.zip";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Card
      title={target.name}
      accessory={
        <Badge tone={target.lastPublishedAt ? "success" : "neutral"}>
          {target.lastPublishedAt
            ? t("publishing.lastPublished", {
                when: formatDateTime(target.lastPublishedAt),
              })
            : t("publishing.neverPublished")}
        </Badge>
      }
    >
      <div className="flex flex-col gap-5">
        {target.warnings.map((warning) => (
          <p key={warning} className="rounded-control bg-warning/12 p-3 text-footnote text-label">
            {warning}
          </p>
        ))}
        <WhatWorks target={target} />
        {canChange && (
          <div className="flex flex-wrap gap-2">
            {target.kind === "zip" ? (
              <Button
                icon={<Download aria-hidden="true" />}
                onClick={() => void download()}
                disabled={isDownloading}
              >
                {isDownloading ? t("publishing.downloading") : t("publishing.download")}
              </Button>
            ) : (
              <>
                <Button
                  icon={<Send aria-hidden="true" />}
                  onClick={() => startPublish()}
                  disabled={isRunning}
                >
                  {isRunning ? t("publishing.publishing") : t("publishing.publish")}
                </Button>
                <Button
                  variant="tinted"
                  icon={<Plug aria-hidden="true" />}
                  onClick={() => test.mutate()}
                  disabled={test.isPending}
                >
                  {test.isPending ? t("publishing.testing") : t("publishing.test")}
                </Button>
              </>
            )}
            <Button
              variant="plain"
              icon={<Pencil aria-hidden="true" />}
              onClick={() => setIsEditing(true)}
            >
              {t("publishing.edit")}
            </Button>
            <Button
              variant="plain"
              icon={<Trash2 aria-hidden="true" />}
              onClick={() => setIsRemoving(true)}
            >
              {t("publishing.delete")}
            </Button>
          </div>
        )}
        <div aria-live="polite" className="flex flex-col gap-2">
          {test.data && <p className="text-footnote text-success">{test.data.message}</p>}
          {test.error && (
            <p role="alert" className="text-footnote text-danger">
              {describeError(test.error)}
            </p>
          )}
          {publish.error && (
            <p role="alert" className="text-footnote text-danger">
              {describeError(publish.error)}
            </p>
          )}
          {downloadError && (
            <p role="alert" className="text-footnote text-danger">
              {downloadError}
            </p>
          )}
          {current?.status === "running" && <Progress run={current} />}
          {current && current.status === "failed" && (
            <p role="alert" className="text-footnote text-danger">
              {current.errorMessage}
            </p>
          )}
        </div>
        <PublishHistory runs={runs.data ?? []} />
      </div>

      {waitingRun && canChange && (
        <ConfirmDialog
          open
          title={t("publishing.confirmDeletionsTitle", {
            count: waitingRun.summary?.deletionsWaiting ?? 0,
          })}
          message={`${t("publishing.confirmDeletionsDescription")}\n\n${(waitingRun.summary?.deleted ?? []).slice(0, 20).join("\n")}`}
          confirmLabel={t("publishing.confirmDeletions")}
          cancelLabel={t("common.cancel")}
          isDestructive
          isWorking={isRunning}
          onConfirm={() => startPublish(true)}
          onCancel={() => void runs.refetch()}
        />
      )}
      {isEditing && (
        <PublishTargetDialog
          target={target}
          isSaving={update.isPending}
          error={update.error}
          onClose={() => setIsEditing(false)}
          onSubmit={(input) => update.mutate(input, { onSuccess: () => setIsEditing(false) })}
        />
      )}
      <ConfirmDialog
        open={isRemoving}
        title={t("publishing.deleteTitle", { name: target.name })}
        message={t("publishing.deleteDescription")}
        confirmLabel={t("publishing.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={remove.isPending}
        onConfirm={() => remove.mutate(target.id, { onSuccess: () => setIsRemoving(false) })}
        onCancel={() => setIsRemoving(false)}
      />
    </Card>
  );
}

function Progress({ run }: { run: PublishRun }) {
  const progress = run.progress ?? { step: "preparing" as const, done: 0, total: 0 };
  const label = t(`publishing.progress.${progress.step}`, {
    done: progress.done,
    total: progress.total,
  });
  return (
    <div className="flex flex-col gap-1.5">
      <progress
        className="h-2 w-full"
        aria-label={t("publishing.progressLabel")}
        max={Math.max(progress.total, 1)}
        value={progress.done}
      />
      <p className="text-footnote text-label-secondary">{label}</p>
    </div>
  );
}

/** Per feature, in plain words, what works when the site is published to this place. */
function WhatWorks({ target }: { target: PublishTarget }) {
  const { enabledPlugins } = useSession();
  const usesBridge = target.kind !== "s3" && target.formDelivery === "bridge";
  const features: Array<{ works: boolean; text: string }> = [
    { works: true, text: t("publishing.feature.pages") },
    { works: true, text: t("publishing.feature.look") },
    { works: true, text: t("publishing.feature.search") },
  ];
  if (enabledPlugins.includes("forms")) {
    features.push(
      target.formDelivery === "none"
        ? { works: false, text: t("publishing.feature.formsNone") }
        : {
            works: true,
            text: t(usesBridge ? "publishing.feature.formsBridge" : "publishing.feature.formsApi"),
          },
    );
  }
  if (enabledPlugins.includes("commerce")) {
    features.push(
      target.kind === "s3" || !usesBridge
        ? { works: false, text: t("publishing.feature.shopBucket") }
        : target.saved.stripeWebhookSecret
          ? {
              works: true,
              text: t("publishing.feature.shopBridge", { provider: "Stripe or Mollie" }),
            }
          : { works: false, text: t("publishing.feature.shopNeedsSetup") },
      { works: false, text: t("publishing.feature.shopInDesigns") },
    );
  }
  if (enabledPlugins.includes("analytics")) {
    features.push({ works: false, text: t("publishing.feature.visitors") });
  }
  if (enabledPlugins.includes("experiments")) {
    features.push({ works: false, text: t("publishing.feature.abTests") });
  }
  features.push({ works: false, text: t("publishing.feature.members") });
  return (
    <section aria-labelledby={`works-${target.id}`}>
      <h3 id={`works-${target.id}`} className="mb-2 text-subheadline font-semibold text-label">
        {t("publishing.whatWorks")}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-2 text-body text-label">
            {feature.works ? (
              <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" />
            ) : (
              <X aria-hidden="true" className="mt-1 size-4 shrink-0 text-danger" />
            )}
            <span>
              <span className="sr-only">
                {feature.works ? t("publishing.works") : t("publishing.doesNotWork")}:{" "}
              </span>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
