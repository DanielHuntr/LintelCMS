import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import {
  conversionWord,
  formatDifference,
  formatRate,
  verdictSentence,
  versionName,
} from "./experimentText.js";
import { useEndExperiment, useExperimentResults } from "./experiments.queries.js";
import type { Experiment, ExperimentResults, VersionKey } from "./experiments.types.js";

/**
 * How each version is doing: visitors, successes, the success rate and the difference from the
 * original, with one plain sentence per version on how sure that is. Ends the test from here:
 * keep the original, or make a version the page (which publishes it).
 */
export function ResultsCard({ experiment }: { experiment: Experiment }) {
  const results = useExperimentResults(experiment.id, experiment.status === "running");
  const end = useEndExperiment(experiment);
  const canPublish = useCan("entries:publish");
  const [ending, setEnding] = useState<VersionKey | null>(null);
  const isEnded = experiment.status === "ended";

  if (results.isError) {
    return (
      <Card title={t("experiments.results.title")}>
        <p role="alert" className="text-footnote text-danger">
          {describeError(results.error)}
        </p>
      </Card>
    );
  }
  if (!results.data) {
    return (
      <LoadingRegion label={t("experiments.results.loading")}>
        <Skeleton className="h-48 rounded-card" />
      </LoadingRegion>
    );
  }
  const data = results.data;
  const challengers = data.versions.filter((version) => version.key !== "original");
  const endingResult = data.versions.find((version) => version.key === ending);

  return (
    <Card title={t("experiments.results.title")}>
      <div className="mb-4 flex flex-col gap-1" aria-live="polite">
        {challengers.map((version) => (
          <p key={version.key} className="text-headline text-label text-pretty">
            {verdictSentence(version)}
          </p>
        ))}
      </div>
      <VersionRows experiment={experiment} results={data} />
      {!data.enoughData && (
        <p className="mt-3 text-footnote text-label-secondary">
          {t("experiments.results.tooFew", {
            visitors: data.minimumVisitors,
            conversions: data.minimumConversions,
          })}
        </p>
      )}
      {!isEnded && (
        <div className="mt-5 flex flex-wrap gap-2">
          {canPublish &&
            challengers.map((version) => (
              <Button
                key={version.key}
                variant={version.comparison?.verdict === "better" ? "filled" : "tinted"}
                onClick={() => setEnding(version.key)}
              >
                {t("experiments.results.makePage", { version: versionName(version.key) })}
              </Button>
            ))}
          <Button variant="plain" onClick={() => setEnding("original")}>
            {t("experiments.results.keepOriginal")}
          </Button>
        </div>
      )}
      {end.error && (
        <p role="alert" className="mt-2 text-footnote text-danger">
          {describeError(end.error)}
        </p>
      )}
      <ConfirmDialog
        open={ending !== null}
        title={
          ending === "original" || ending === null
            ? t("experiments.results.keepTitle")
            : t("experiments.results.makePageTitle", { version: versionName(ending) })
        }
        message={
          ending === "original" || ending === null
            ? t("experiments.results.keepMessage")
            : [
                t("experiments.results.makePageMessage", { version: versionName(ending) }),
                endingResult?.comparison?.verdict === "better"
                  ? ""
                  : t("experiments.results.makePageEarly", { version: versionName(ending) }),
              ]
                .filter(Boolean)
                .join(" ")
        }
        confirmLabel={
          ending === "original"
            ? t("experiments.results.endConfirm")
            : t("experiments.results.publishConfirm")
        }
        cancelLabel={t("experiments.results.cancel")}
        isWorking={end.isPending}
        onCancel={() => setEnding(null)}
        onConfirm={() => {
          if (ending) end.mutate(ending, { onSettled: () => setEnding(null) });
        }}
      />
    </Card>
  );
}

function VersionRows({
  experiment,
  results,
}: {
  experiment: Experiment;
  results: ExperimentResults;
}) {
  return (
    <ul className="flex flex-col">
      {results.versions.map((version) => {
        const difference = formatDifference(version.comparison?.relativeDifference ?? null);
        return (
          <li
            key={version.key}
            className="flex items-center justify-between gap-4 border-t border-separator py-3"
          >
            <div className="min-w-0">
              <p className="text-body font-medium text-label">{versionName(version.key)}</p>
              <p className="text-footnote text-label-secondary">
                {t("experiments.results.visitors", { count: version.visitors })} ·{" "}
                {conversionWord(experiment.goal, version.conversions)}
              </p>
            </div>
            <div className="shrink-0 text-end">
              <p className="text-headline text-label tabular-nums">
                {formatRate(version.rate)}
                <span className="sr-only"> {t("experiments.results.rateLabel")}</span>
              </p>
              {difference && (
                <p className="text-footnote text-label-secondary tabular-nums">
                  {t("experiments.results.againstOriginal", { difference })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
