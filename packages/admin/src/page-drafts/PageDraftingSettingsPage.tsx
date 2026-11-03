import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FolderInput, ShieldCheck, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import {
  cancelModelDownload,
  checkCopiedModel,
  type ModelStatus,
  readModelStatus,
  removeModel,
  startModelDownload,
} from "./pageDrafts.api.js";

const statusKey = ["drafts", "model"] as const;

export function formatBytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * /settings/page-drafting: what the writing model is, where it comes from and where it goes,
 * all before anything is downloaded; then the download (cancel and resume), or copying the
 * files in by hand; and once installed, what's there and a Remove button.
 */
export function PageDraftingSettingsPage() {
  const status = useQuery({
    queryKey: statusKey,
    queryFn: readModelStatus,
    refetchInterval: (query) =>
      query.state.data?.state === "downloading" || query.state.data?.state === "checking"
        ? 1000
        : false,
  });
  return (
    <Page width="readable">
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("pageDrafts.settingsTitle")} subtitle={t("pageDrafts.subtitle")} />
      {status.isError && <LoadError error={status.error} onRetry={() => void status.refetch()} />}
      {status.isPending && (
        <LoadingRegion label={t("pageDrafts.loading")}>
          <Skeleton className="h-96 rounded-card" />
        </LoadingRegion>
      )}
      {status.data && <ModelSetup status={status.data} />}
    </Page>
  );
}

function ModelSetup({ status }: { status: ModelStatus }) {
  const queryClient = useQueryClient();
  const canChange = useCan("settings:update");
  const [isCopyingIn, setCopyingIn] = useState(false);
  const [isConfirmingRemove, setConfirmingRemove] = useState(false);
  const act = useMutation({
    mutationFn: (action: () => Promise<ModelStatus>) => action(),
    onSuccess: (next) => queryClient.setQueryData(statusKey, next),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["drafts"] }),
  });
  const { model, server } = status;
  const remaining = model.sizeInBytes - status.bytesOnDisk;
  const share = Math.min(1, status.bytesOnDisk / model.sizeInBytes);
  const problem =
    act.error instanceof ApiError && act.error.message
      ? act.error.message
      : act.error
        ? describeError(act.error)
        : status.problem;
  const canStart = ["not-installed", "paused", "failed"].includes(status.state);

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-3 rounded-card bg-surface p-4 text-body text-label">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
        {t("pageDrafts.privacy")}
      </p>

      <section aria-labelledby="page-drafts-model" className="rounded-card bg-surface p-5">
        <h2 id="page-drafts-model" className="mb-3 text-headline text-label">
          {t("pageDrafts.modelHeader")}
        </h2>
        <dl className="grid gap-x-6 gap-y-2.5 text-body sm:grid-cols-[9rem_1fr]">
          <Detail term={t("pageDrafts.model")}>
            <a href={model.sourcePage} className="text-accent underline-offset-2 hover:underline">
              {model.name}
            </a>
          </Detail>
          <Detail term={t("pageDrafts.maker")}>{model.maker}</Detail>
          <Detail term={t("pageDrafts.licence")}>
            <a href={model.licenceUrl} className="text-accent underline-offset-2 hover:underline">
              {model.licence}
            </a>
          </Detail>
          <Detail term={t("pageDrafts.size")}>{formatBytes(model.sizeInBytes)}</Detail>
          <Detail term={t("pageDrafts.memory")}>
            {t("pageDrafts.memoryValue", { size: formatBytes(model.memoryNeededInBytes) })}
          </Detail>
          <Detail term={t("pageDrafts.source")}>
            <ul className="flex flex-col gap-1">
              {model.files.map((file) => (
                <li
                  key={file.name}
                  className="font-mono text-footnote break-all text-label-secondary"
                >
                  {file.url}
                </li>
              ))}
            </ul>
          </Detail>
          <Detail term={t("pageDrafts.folder")}>
            <span className="font-mono text-footnote break-all text-label-secondary">
              {status.folder}
            </span>
          </Detail>
        </dl>
      </section>

      {!server.hasEnoughMemory && (
        <Warning>
          {t("pageDrafts.tooLittleMemory", {
            total: formatBytes(server.totalMemoryInBytes),
            needed: formatBytes(model.memoryNeededInBytes),
          })}
        </Warning>
      )}
      {!server.hasEnoughDisk && status.state !== "installed" && (
        <Warning>
          {t("pageDrafts.tooLittleDisk", {
            free: formatBytes(server.freeDiskInBytes),
            needed: formatBytes(remaining),
          })}
        </Warning>
      )}
      {problem && (
        <p role="alert" className="rounded-card bg-danger/10 p-4 text-body text-label">
          {problem}
        </p>
      )}

      {status.state === "downloading" && (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-headline text-label">{t("pageDrafts.downloading")}</h2>
            <span className="text-footnote text-label-secondary tabular-nums">
              {t("pageDrafts.downloaded", {
                done: formatBytes(status.bytesOnDisk),
                total: formatBytes(model.sizeInBytes),
              })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t("pageDrafts.downloading")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
            className="h-2 overflow-hidden rounded-full bg-fill"
          >
            <div
              className="h-full rounded-full bg-accent-fill transition-[width] duration-700 motion-reduce:transition-none"
              style={{ width: `${share * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-footnote text-label-secondary">{t("pageDrafts.cancelNote")}</p>
            {canChange && (
              <Button variant="tinted" onClick={() => act.mutate(cancelModelDownload)}>
                {t("pageDrafts.cancel")}
              </Button>
            )}
          </div>
        </section>
      )}

      {status.state === "checking" && (
        <p aria-live="polite" className="rounded-card bg-surface p-5 text-body text-label">
          {t("pageDrafts.checking")}
        </p>
      )}

      {status.state === "installed" && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-surface p-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="flex items-center gap-2 text-headline text-label">
              <ShieldCheck aria-hidden="true" className="size-5 text-success" />
              {t("pageDrafts.installed")}
            </h2>
            <p className="text-footnote text-label-secondary">{t("pageDrafts.installedNote")}</p>
          </div>
          {canChange && (
            <Button
              variant="destructive"
              icon={<Trash2 aria-hidden="true" className="size-4" />}
              onClick={() => setConfirmingRemove(true)}
            >
              {t("pageDrafts.remove")}
            </Button>
          )}
        </section>
      )}

      {canChange && canStart && (
        <section className="flex flex-col gap-4">
          {status.state === "paused" && (
            <p className="text-footnote text-label-secondary">
              {t("pageDrafts.paused", {
                done: formatBytes(status.bytesOnDisk),
                total: formatBytes(model.sizeInBytes),
              })}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={act.isPending || !server.hasEnoughDisk}
              icon={<Download aria-hidden="true" className="size-4" />}
              onClick={() => act.mutate(startModelDownload)}
            >
              {status.bytesOnDisk > 0
                ? t("pageDrafts.resume")
                : t("pageDrafts.download", { size: formatBytes(model.sizeInBytes) })}
            </Button>
            <Button
              variant="plain"
              aria-expanded={isCopyingIn}
              icon={<FolderInput aria-hidden="true" className="size-4" />}
              onClick={() => setCopyingIn(!isCopyingIn)}
            >
              {t("pageDrafts.copyIn")}
            </Button>
          </div>
          {isCopyingIn && (
            <div className="flex flex-col gap-3 rounded-card bg-surface p-5 text-body">
              <p className="text-label">{t("pageDrafts.copyInHelp")}</p>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[9rem_1fr]">
                <Detail term={t("pageDrafts.copyInFolder")}>
                  <span className="font-mono text-footnote break-all">{status.folder}</span>
                </Detail>
                <Detail term={t("pageDrafts.copyInFiles")}>
                  <ul className="flex flex-col gap-1">
                    {model.files.map((file) => (
                      <li key={file.name} className="font-mono text-footnote break-all">
                        {file.name}
                      </li>
                    ))}
                  </ul>
                </Detail>
              </dl>
              <div>
                <Button variant="tinted" onClick={() => act.mutate(checkCopiedModel)}>
                  {t("pageDrafts.check")}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={isConfirmingRemove}
        title={t("pageDrafts.removeTitle")}
        message={t("pageDrafts.removeMessage", { size: formatBytes(model.sizeInBytes) })}
        confirmLabel={t("pageDrafts.remove")}
        cancelLabel={t("pageDrafts.removeCancel")}
        isDestructive
        isWorking={act.isPending}
        onConfirm={() => act.mutate(removeModel, { onSettled: () => setConfirmingRemove(false) })}
        onCancel={() => setConfirmingRemove(false)}
      />
    </div>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-label-secondary">{term}</dt>
      <dd className="min-w-0 text-label">{children}</dd>
    </>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return <p className="rounded-card bg-warning/14 p-4 text-body text-label">{children}</p>;
}
