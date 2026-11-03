import { useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { t } from "../i18n/strings.js";
import { versionName } from "./experimentText.js";
import { useUpdateExperiment } from "./experiments.queries.js";
import type { Experiment, VersionKey } from "./experiments.types.js";

/**
 * The versions and the share of visitors each gets: even unless changed, which is hidden
 * behind one button because the default is right for nearly everyone.
 */
export function VersionsCard({ experiment }: { experiment: Experiment }) {
  const keys: VersionKey[] = ["original", ...experiment.versions.map((version) => version.key)];
  const [draft, setDraft] = useState<number[] | null>(null);
  const update = useUpdateExperiment(experiment);
  const canChange = experiment.status === "draft" || experiment.status === "stopped";
  const total = draft?.reduce((sum, share) => sum + share, 0) ?? 100;
  const fieldId = useId();

  return (
    <Card title={t("experiments.versions.title")}>
      <p className="mb-3 text-footnote text-label-secondary">
        {t(
          experiment.scope === "section"
            ? "experiments.versions.oneSection"
            : "experiments.versions.wholePage",
        )}
      </p>
      <ul className="flex flex-col">
        {keys.map((key, index) => (
          <li
            key={key}
            className="flex min-h-11 items-center justify-between gap-3 border-t border-separator py-2 first:border-t-0"
          >
            {draft ? (
              <label htmlFor={`${fieldId}-${key}`} className="text-body text-label">
                {versionName(key)}
              </label>
            ) : (
              <span className="text-body text-label">{versionName(key)}</span>
            )}
            {draft ? (
              <span className="flex items-center gap-1">
                <input
                  id={`${fieldId}-${key}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={draft[index] ?? 0}
                  onChange={(event) => {
                    const next = [...draft];
                    next[index] = Math.round(Number(event.target.value) || 0);
                    setDraft(next);
                  }}
                  className="h-9 w-20 rounded-control bg-fill px-3 text-end text-body text-label tabular-nums focus-visible:focus-ring"
                />
                <span aria-hidden="true" className="text-body text-label-secondary">
                  %
                </span>
              </span>
            ) : (
              <span className="text-footnote text-label-secondary tabular-nums">
                {t("experiments.versions.share", { share: experiment.split[index] ?? 0 })}
              </span>
            )}
          </li>
        ))}
      </ul>
      {draft ? (
        <div className="mt-3 flex flex-col gap-2">
          {total !== 100 && (
            <p role="alert" className="text-footnote text-warning">
              {t("experiments.versions.splitTotal", { total })}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="small"
              disabled={total !== 100 || update.isPending}
              onClick={() => update.mutate({ split: draft }, { onSuccess: () => setDraft(null) })}
            >
              {t("experiments.versions.saveSplit")}
            </Button>
            <Button variant="plain" size="small" onClick={() => setDraft(null)}>
              {t("experiments.versions.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        canChange && (
          <div className="mt-2">
            <Button variant="plain" size="small" onClick={() => setDraft([...experiment.split])}>
              {t("experiments.versions.changeSplit")}
            </Button>
          </div>
        )
      )}
      {update.error && (
        <p role="alert" className="mt-2 text-footnote text-danger">
          {describeError(update.error)}
        </p>
      )}
    </Card>
  );
}
