import { CircleAlert, CircleCheck, CircleDashed, Clock, History, RotateCw } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { formatDateTime, formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { EmptyState } from "../design/EmptyState.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { RunStatusBadge } from "./RunStatusBadge.js";
import { useCancelRun, useRun, useRuns } from "./workflows.queries.js";
import type { StepLog } from "./workflows.types.js";

interface RunHistoryProps {
  workflowId: string;
  /** The run shown open; the list's other runs are closed. */
  openRunId: string | undefined;
  onOpenRun: (runId: string | undefined) => void;
  canChange: boolean;
}

/** Every run, newest first; opening one shows what each step did. */
export function RunHistory({ workflowId, openRunId, onOpenRun, canChange }: RunHistoryProps) {
  const runs = useRuns(workflowId);
  const now = useNow();

  if (runs.isError) return <LoadError error={runs.error} onRetry={() => void runs.refetch()} />;
  if (runs.isPending) {
    return (
      <LoadingRegion label={t("history.loading")}>
        <Skeleton className="h-14 rounded-card" />
      </LoadingRegion>
    );
  }
  if (runs.data.runs.length === 0) {
    return (
      <div className="rounded-card bg-surface">
        <EmptyState
          icon={History}
          title={t("history.emptyTitle")}
          description={t("history.emptyDescription")}
        />
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {runs.data.runs.map((run) => {
        const isOpen = run.id === openRunId;
        return (
          <li key={run.id} className="rounded-card bg-surface">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-label={t("history.showRun", { when: formatDateTime(run.createdAt) })}
              onClick={() => onOpenRun(isOpen ? undefined : run.id)}
              className="flex w-full items-center gap-3 rounded-card px-4 py-3 text-left hover:bg-fill/50 focus-visible:focus-ring-inset"
            >
              <RunStatusBadge status={run.status} />
              {run.isTest && <Badge tone="accent">{t("history.test")}</Badge>}
              <span className="flex-1 text-body text-label">
                {formatRelativeTime(run.createdAt, now)}
              </span>
              {run.error && <span className="truncate text-footnote text-danger">{run.error}</span>}
            </button>
            {isOpen && <RunSteps runId={run.id} workflowId={workflowId} canChange={canChange} />}
          </li>
        );
      })}
    </ul>
  );
}

function RunSteps({
  runId,
  workflowId,
  canChange,
}: {
  runId: string;
  workflowId: string;
  canChange: boolean;
}) {
  const run = useRun(runId);
  const cancel = useCancelRun(workflowId);
  const now = useNow();
  if (run.isError) return <LoadError error={run.error} onRetry={() => void run.refetch()} />;
  if (!run.data) {
    return (
      <LoadingRegion label={t("history.loading")}>
        <Skeleton className="mx-4 mb-3 h-10 rounded-control" />
      </LoadingRegion>
    );
  }
  const stillGoing = ["queued", "running", "waiting"].includes(run.data.status);
  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-4 hairline-top">
      <h3 className="pt-3 text-footnote font-semibold text-label-secondary">
        {t("history.stepsLabel")}
      </h3>
      {run.data.logs.length === 0 && (
        <p className="text-footnote text-label-secondary">{t("history.noSteps")}</p>
      )}
      <ol className="flex flex-col gap-2">
        {run.data.logs.map((log) => (
          <LogLine key={log.id} log={log} />
        ))}
      </ol>
      {run.data.status === "waiting" && (
        <p className="text-footnote text-label-secondary">
          {run.data.nextRunAt
            ? t("history.nextAt", { when: formatRelativeTime(run.data.nextRunAt, now) })
            : t("history.waitingForAnswer")}
        </p>
      )}
      {canChange && stillGoing && (
        <div>
          <Button
            variant="destructive"
            size="small"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(runId)}
          >
            {t("history.stop")}
          </Button>
        </div>
      )}
    </div>
  );
}

const logIcons = {
  succeeded: { icon: CircleCheck, tone: "text-success" },
  failed: { icon: CircleAlert, tone: "text-danger" },
  skipped: { icon: CircleDashed, tone: "text-label-tertiary" },
  waiting: { icon: Clock, tone: "text-warning" },
  retrying: { icon: RotateCw, tone: "text-warning" },
} as const;

function LogLine({ log }: { log: StepLog }) {
  const { icon: Icon, tone } = logIcons[log.status];
  return (
    <li className="flex gap-2.5">
      <Icon aria-hidden="true" className={classNames("mt-0.5 size-4 shrink-0", tone)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-footnote text-label">
          <span className="sr-only">{t(`history.log.${log.status}`)}: </span>
          <span className="font-mono text-label-secondary">{log.stepId}</span> {log.summary}
          {log.attempt > 1 && (
            <span className="text-label-secondary">
              {" "}
              · {t("history.attempt", { attempt: log.attempt })}
            </span>
          )}
        </p>
        {log.detail && (
          <details className="text-footnote">
            <summary className="cursor-pointer text-accent focus-visible:focus-ring">
              {t("history.details")}
            </summary>
            <pre className="mt-1 max-h-64 overflow-auto rounded-control bg-fill p-2 font-mono text-caption whitespace-pre-wrap text-label">
              {JSON.stringify(log.detail, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </li>
  );
}
