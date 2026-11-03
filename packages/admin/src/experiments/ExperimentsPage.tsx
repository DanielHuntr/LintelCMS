import { Split } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { Badge } from "../design/Badge.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import type { Tone } from "../design/tones.js";
import { t } from "../i18n/strings.js";
import { describeGoal } from "./experimentText.js";
import { useExperiments } from "./experiments.queries.js";
import type { Experiment, ExperimentStatus } from "./experiments.types.js";

export const statusTones: Record<ExperimentStatus, Tone> = {
  draft: "neutral",
  running: "success",
  stopped: "warning",
  ended: "neutral",
};

/** /experiments: every A/B test, newest first. Tests are made from the page designer. */
export function ExperimentsPage() {
  const experiments = useExperiments();
  return (
    <>
      <LargeTitle title={t("experiments.list.title")} subtitle={t("experiments.list.subtitle")} />
      {experiments.isError && (
        <LoadError error={experiments.error} onRetry={() => void experiments.refetch()} />
      )}
      {experiments.isPending && (
        <LoadingRegion label={t("experiments.list.loading")}>
          <Skeleton className="h-14 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {experiments.data?.length === 0 && (
        <div className="max-w-2xl rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Split}
            title={t("experiments.list.emptyTitle")}
            description={t("experiments.list.emptyDescription")}
          />
        </div>
      )}
      {experiments.data && experiments.data.length > 0 && (
        <div className="max-w-2xl">
          <GroupedList footer={t("experiments.list.footer")}>
            {experiments.data.map((experiment) => (
              <GroupedListRow
                key={experiment.id}
                icon={Split}
                iconTone={experiment.status === "running" ? "success" : "neutral"}
                label={experiment.pageTitle || t("experiments.list.untitled")}
                description={describeRow(experiment)}
                accessory={
                  <Badge tone={statusTones[experiment.status]}>
                    {t(`experiments.status.${experiment.status}`)}
                  </Badge>
                }
                to={`/experiments/${encodeURIComponent(experiment.id)}`}
              />
            ))}
          </GroupedList>
        </div>
      )}
    </>
  );
}

function describeRow(experiment: Experiment): string {
  const parts = [
    t("experiments.list.versions", { count: experiment.versions.length + 1 }),
    describeGoal(experiment.goal),
  ];
  if (experiment.scope === "section") parts.splice(1, 0, t("experiments.list.section"));
  return parts.join(" · ");
}
