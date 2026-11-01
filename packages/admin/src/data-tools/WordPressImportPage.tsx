import { CircleCheck, PauseCircle } from "lucide-react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useStartWordPressImport, useWordPressImport } from "./dataTools.queries.js";
import type { WordPressImport } from "./wordpressImport.api.js";
import { WordPressMappingStep } from "./WordPressMappingStep.js";
import { WordPressReport } from "./WordPressReport.js";

/**
 * /settings/import/wordpress/:id: one import, from choosing where things go, through the
 * dry run and the progress bar, to the finished report. A paused import can be resumed.
 */
export function WordPressImportPage({ importId }: { importId: string }) {
  const current = useWordPressImport(importId);
  const start = useStartWordPressImport(importId);
  const data = current.data;

  return (
    <>
      <BackLink to="/settings/import/wordpress">{t("wordpress.title")}</BackLink>
      <LargeTitle
        title={data?.siteTitle || data?.filename || t("wordpress.title")}
        subtitle={data?.siteAddress}
      />
      {current.isError && <LoadError error={current.error} onRetry={() => void current.refetch()} />}
      {current.isPending && (
        <LoadingRegion label={t("wordpress.loading")}>
          <Skeleton className="h-64 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {data && (
        <div className="flex max-w-2xl flex-col gap-6">
          <FoundCard found={data.found} />
          {data.status === "ready" && (
            <WordPressMappingStep
              importId={importId}
              isStarting={start.isPending}
              startError={start.isError ? describeError(start.error) : null}
              onStart={() => start.mutate()}
            />
          )}
          {data.status === "running" && <ProgressCard progress={data.progress} />}
          {data.status === "paused" && (
            <Card>
              <div className="flex items-start gap-3">
                <PauseCircle aria-hidden="true" className="size-6 shrink-0 text-warning" />
                <div className="flex flex-col gap-2">
                  <h2 className="text-headline text-label">{t("wordpress.pausedTitle")}</h2>
                  <p className="text-body text-label-secondary">{t("wordpress.pausedText")}</p>
                  {data.lastError && <p className="text-footnote text-label-secondary">{data.lastError}</p>}
                  <ProgressBar progress={data.progress} />
                  <div>
                    <Button onClick={() => start.mutate()} disabled={start.isPending}>
                      {t("wordpress.resume")}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
          {data.status === "complete" && data.report && (
            <Card>
              <h2 className="mb-4 flex items-center gap-2 text-headline text-label">
                <CircleCheck aria-hidden="true" className="size-5 text-success" />
                {t("wordpress.reportTitle")}
              </h2>
              <WordPressReport report={data.report} />
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function FoundCard({ found }: { found: WordPressImport["found"] }) {
  const { ignored: ignoredTypes, ...counts } = found;
  const ignored = Object.entries(ignoredTypes).map(([type, count]) => `${count} ${type.replace(/_/g, " ")}`);
  return (
    <Card title={t("wordpress.foundTitle")}>
      <p className="text-body text-label">{t("wordpress.found", counts)}</p>
      {ignored.length > 0 && (
        <p className="mt-1 text-footnote text-label-secondary">
          {t("wordpress.ignored", { list: ignored.join(", ") })}
        </p>
      )}
    </Card>
  );
}

function ProgressCard({ progress }: { progress: WordPressImport["progress"] }) {
  return (
    <Card title={t("wordpress.progressTitle")}>
      <ProgressBar progress={progress} />
      <p className="mt-2 text-footnote text-label-secondary">{t("wordpress.progressHint")}</p>
    </Card>
  );
}

function ProgressBar({ progress }: { progress: WordPressImport["progress"] }) {
  const percent = progress.total === 0 ? 100 : Math.round((progress.done / progress.total) * 100);
  const label = t("wordpress.progress", { done: progress.done, total: progress.total });
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-fill"
      >
        <div
          className="h-full rounded-full bg-accent-fill motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
      <p className="text-footnote text-label" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
