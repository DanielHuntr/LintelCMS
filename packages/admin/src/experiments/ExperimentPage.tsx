import { useNavigate } from "@tanstack/react-router";
import { Pause, PencilRuler, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { describeError } from "../api/describeError.js";
import { formatDateTime } from "../content/relativeTime.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { statusTones } from "./ExperimentsPage.js";
import { GoalCard } from "./GoalCard.js";
import { ResultsCard } from "./ResultsCard.js";
import { VersionsCard } from "./VersionsCard.js";
import { versionName } from "./experimentText.js";
import {
  useDeleteExperiment,
  useExperiment,
  useStartStopExperiment,
} from "./experiments.queries.js";
import type { Experiment } from "./experiments.types.js";

/** /experiments/<id>: one A/B test: its results, its goal, its versions, start and pause. */
export function ExperimentPage({ experimentId }: { experimentId: string }) {
  const experiment = useExperiment(experimentId);
  if (experiment.isError) {
    return <LoadError error={experiment.error} onRetry={() => void experiment.refetch()} />;
  }
  if (!experiment.data) {
    return (
      <LoadingRegion label={t("experiments.detail.loading")}>
        <div className="flex max-w-2xl flex-col gap-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      </LoadingRegion>
    );
  }
  return <ExperimentScreen experiment={experiment.data} />;
}

function ExperimentScreen({ experiment }: { experiment: Experiment }) {
  const startStop = useStartStopExperiment(experiment);
  const remove = useDeleteExperiment(experiment);
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { status } = experiment;
  const isEnded = status === "ended";

  const toggle = (action: "start" | "stop") =>
    startStop.mutate(action, {
      onSuccess: () =>
        setAnnouncement(
          t(action === "start" ? "experiments.detail.started" : "experiments.detail.paused"),
        ),
    });

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <BackLink to="/experiments">{t("experiments.detail.back")}</BackLink>
        <LargeTitle
          title={experiment.pageTitle || t("experiments.list.untitled")}
          subtitle={subtitle(experiment)}
          actions={
            <>
              <Badge tone={statusTones[status]}>{t(`experiments.status.${status}`)}</Badge>
              {!isEnded && (
                <LinkButton
                  variant="tinted"
                  icon={<PencilRuler aria-hidden="true" />}
                  to="/content/$collection/$entryId/design/$field"
                  params={{
                    collection: experiment.collection,
                    entryId: experiment.entryId,
                    field: "design",
                  }}
                >
                  {t("experiments.detail.editVersions")}
                </LinkButton>
              )}
              {status === "running" && (
                <Button
                  variant="tinted"
                  icon={<Pause aria-hidden="true" />}
                  disabled={startStop.isPending}
                  onClick={() => toggle("stop")}
                >
                  {t("experiments.detail.pause")}
                </Button>
              )}
              {(status === "draft" || status === "stopped") && (
                <Button
                  icon={<Play aria-hidden="true" />}
                  disabled={startStop.isPending}
                  onClick={() => toggle("start")}
                >
                  {t(status === "draft" ? "experiments.detail.start" : "experiments.detail.resume")}
                </Button>
              )}
            </>
          }
        />
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {startStop.error && (
          <p role="alert" className="mt-2 text-footnote text-danger">
            {describeError(startStop.error)}
          </p>
        )}
      </div>

      {experiment.startedAt && <ResultsCard experiment={experiment} />}
      <GoalCard experiment={experiment} />
      <VersionsCard experiment={experiment} />

      {status !== "running" && (
        <div>
          <Button
            variant="plain"
            className="text-danger"
            icon={<Trash2 aria-hidden="true" />}
            onClick={() => setIsDeleting(true)}
          >
            {t("experiments.detail.delete")}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={isDeleting}
        title={t("experiments.detail.deleteTitle")}
        message={t("experiments.detail.deleteMessage")}
        confirmLabel={t("experiments.detail.delete")}
        cancelLabel={t("experiments.results.cancel")}
        isDestructive
        isWorking={remove.isPending}
        onCancel={() => setIsDeleting(false)}
        onConfirm={() =>
          remove.mutate(undefined, { onSuccess: () => void navigate({ to: "/experiments" }) })
        }
      />
    </div>
  );
}

function subtitle(experiment: Experiment): string {
  switch (experiment.status) {
    case "draft":
      return t("experiments.detail.subtitle.draft");
    case "running":
      return t("experiments.detail.subtitle.running", {
        date: formatDateTime(experiment.startedAt ?? experiment.createdAt),
      });
    case "stopped":
      return t("experiments.detail.subtitle.stopped");
    case "ended":
      return t("experiments.detail.subtitle.ended", {
        date: formatDateTime(experiment.endedAt ?? experiment.createdAt),
        winner:
          !experiment.winner || experiment.winner === "original"
            ? t("experiments.detail.endedWith.original")
            : t("experiments.detail.endedWith.version", {
                version: versionName(experiment.winner),
              }),
      });
  }
}
