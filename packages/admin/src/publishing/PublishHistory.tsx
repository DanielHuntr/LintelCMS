import { Badge } from "../design/Badge.js";
import type { Tone } from "../design/tones.js";
import { formatDateTime } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";
import type { PublishRun, PublishRunStatus } from "./publishing.api.js";

const statusTones: Record<PublishRunStatus, Tone> = {
  succeeded: "success",
  failed: "danger",
  running: "accent",
  needsConfirmation: "warning",
};

/** The last publishes to one destination: when, why, what changed and what went wrong. */
export function PublishHistory({ runs }: { runs: readonly PublishRun[] }) {
  return (
    <section aria-label={t("publishing.history")}>
      <h3 className="mb-2 text-subheadline font-semibold text-label">{t("publishing.history")}</h3>
      {runs.length === 0 ? (
        <p className="text-footnote text-label-secondary">{t("publishing.historyEmpty")}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-separator">
          {runs.slice(0, 10).map((run) => (
            <li key={run.id} className="flex flex-col gap-1 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTones[run.status]}>{t(`publishing.run.${run.status}`)}</Badge>
                <span className="text-footnote text-label-secondary">
                  {formatDateTime(run.startedAt)} · {t(`publishing.run.trigger.${run.trigger}`)}
                </span>
              </div>
              {run.summary && (
                <p className="text-footnote text-label">
                  {t("publishing.run.summary", {
                    uploaded: run.summary.uploadedCount,
                    deleted: run.summary.deletedCount,
                    pages: run.summary.pagesRebuilt,
                  })}
                  {run.summary.formsPulled + run.summary.ordersPulled > 0 &&
                    ` · ${t("publishing.run.collected", { forms: run.summary.formsPulled, orders: run.summary.ordersPulled })}`}
                </p>
              )}
              {run.errorMessage && <p className="text-footnote text-danger">{run.errorMessage}</p>}
              {run.summary?.warnings.map((warning) => (
                <p key={warning} className="text-footnote text-label-secondary">
                  {warning}
                </p>
              ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
