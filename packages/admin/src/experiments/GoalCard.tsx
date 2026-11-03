import type { PageDocument } from "@lintel/builder-model";
import { useMemo, useState } from "react";
import { describeError } from "../api/describeError.js";
import { useEntry } from "../content/content.queries.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { SelectField } from "../design/SelectField.js";
import { t } from "../i18n/strings.js";
import { usePagePicker } from "../page-links/usePagePicker.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { useVisitorStats } from "../analytics/analytics.queries.js";
import { useForms } from "../forms/forms.queries.js";
import { describeAnalyticsGoal, linksOnPages } from "./experimentText.js";
import { useUpdateExperiment } from "./experiments.queries.js";
import type { Experiment, ExperimentGoal } from "./experiments.types.js";

type GoalKind = ExperimentGoal["kind"];

/**
 * "What counts as success": a form sent, an order, a click on one of the page's buttons or
 * links, or reaching a page. Saved as soon as it is complete. Fixed while the test runs.
 */
export function GoalCard({ experiment }: { experiment: Experiment }) {
  const update = useUpdateExperiment(experiment);
  const session = useSession();
  const pagePicker = usePagePicker();
  const page = useEntry(experiment.entryId);
  const goal = experiment.goal;
  const [pendingKind, setPendingKind] = useState<GoalKind | null>(null);
  const kind = pendingKind ?? goal?.kind ?? "";
  const isLocked = experiment.status === "running" || experiment.status === "ended";
  const countsVisitors = session.enabledPlugins.includes("analytics");
  const counted = useCountedGoals(countsVisitors && kind === "analytics");

  const links = useMemo(() => {
    const original = page.data?.data.design as PageDocument | undefined;
    return linksOnPages([original, ...experiment.versions.map((version) => version.design)]);
  }, [page.data, experiment.versions]);

  const goalPageId = goal?.kind === "page" ? goal.entryId : undefined;
  const goalPage = useEntry(goalPageId);

  const save = (next: ExperimentGoal) =>
    update.mutate({ goal: next }, { onSuccess: () => setPendingKind(null) });

  const chooseKind = (value: string) => {
    const next = value as GoalKind;
    if (next === "form" || next === "order") save({ kind: next });
    else setPendingKind(next);
  };

  const kinds: { value: GoalKind; label: string }[] = [
    { value: "form", label: t("experiments.goal.form") },
    ...(session.enabledPlugins.includes("commerce")
      ? [{ value: "order" as const, label: t("experiments.goal.order") }]
      : []),
    { value: "click", label: t("experiments.goal.click") },
    { value: "page", label: t("experiments.goal.page") },
    ...(countsVisitors || goal?.kind === "analytics"
      ? [{ value: "analytics" as const, label: t("experiments.goal.analytics") }]
      : []),
  ];
  const chosenName = goal?.kind === "analytics" ? goal.name : "";
  const countedOptions = [
    ...counted,
    ...(chosenName && !counted.some((option) => option.value === chosenName)
      ? [{ value: chosenName, label: describeAnalyticsGoal(chosenName) }]
      : []),
  ];

  const choosePage = async () => {
    const picked = await pagePicker.pick();
    if (picked) save({ kind: "page", entryId: picked.id });
  };

  return (
    <Card title={t("experiments.goal.title")}>
      <div className="flex flex-col gap-4">
        <SelectField
          label={t("experiments.goal.label")}
          value={kind}
          disabled={isLocked || update.isPending}
          onValueChange={chooseKind}
          options={[
            ...(kind === "" ? [{ value: "", label: t("experiments.goal.choose") }] : []),
            ...kinds,
          ]}
        />
        {kind === "click" &&
          (links.length === 0 ? (
            <p className="text-footnote text-label-secondary">{t("experiments.goal.noLinks")}</p>
          ) : (
            <SelectField
              label={t("experiments.goal.whichLink")}
              value={goal?.kind === "click" ? goal.target : ""}
              disabled={isLocked || update.isPending}
              onValueChange={(target) => {
                const link = links.find((candidate) => candidate.href === target);
                if (link) save({ kind: "click", target: link.href, label: link.label });
              }}
              options={[
                ...(goal?.kind === "click"
                  ? []
                  : [{ value: "", label: t("experiments.goal.choose") }]),
                ...links.map((link) => ({ value: link.href, label: link.label })),
              ]}
            />
          ))}
        {kind === "page" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-footnote font-medium text-label">
              {t("experiments.goal.whichPage")}
            </span>
            <div className="flex items-center gap-3">
              {goalPage.data && (
                <span className="truncate text-body text-label">
                  {String(goalPage.data.data.title ?? "")}
                </span>
              )}
              <Button
                variant={goalPageId ? "plain" : "tinted"}
                size="small"
                disabled={isLocked || update.isPending}
                onClick={() => void choosePage()}
              >
                {goalPageId ? t("experiments.goal.changePage") : t("experiments.goal.choosePage")}
              </Button>
            </div>
          </div>
        )}
        {kind === "analytics" &&
          (countedOptions.length === 0 ? (
            <p className="text-footnote text-label-secondary">
              {t("experiments.goal.nothingCounted")}
            </p>
          ) : (
            <SelectField
              label={t("experiments.goal.whichOne")}
              value={chosenName}
              disabled={isLocked || update.isPending}
              onValueChange={(name) => {
                if (name) save({ kind: "analytics", name });
              }}
              options={[
                ...(chosenName ? [] : [{ value: "", label: t("experiments.goal.choose") }]),
                ...countedOptions,
              ]}
            />
          ))}
        <p className="text-footnote text-label-secondary">
          {isLocked && experiment.status === "running"
            ? t("experiments.versions.pauseToChange")
            : t("experiments.goal.hint")}
        </p>
        {update.error && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(update.error)}
          </p>
        )}
      </div>
      {pagePicker.dialog}
    </Card>
  );
}

/**
 * What Visitors can count as a goal: the site's forms, orders when the shop is on, and the
 * events the site has sent in the last 30 days, by their names there ("form:contact").
 */
function useCountedGoals(enabled: boolean): { value: string; label: string }[] {
  const session = useSession();
  const canSeeForms = useCan("forms:read") && session.enabledPlugins.includes("forms");
  const canSeeVisitors = useCan("analytics:read");
  const forms = useForms(enabled && canSeeForms);
  const stats = useVisitorStats({ range: "30d" }, enabled && canSeeVisitors);
  return useMemo(
    () => [
      ...(forms.data ?? []).map((form) => ({
        value: `form:${form.handle}`,
        label: t("experiments.goal.namedForm", { form: form.name }),
      })),
      ...(session.enabledPlugins.includes("commerce")
        ? [{ value: "order", label: t("experiments.goal.placesOrder") }]
        : []),
      ...(stats.data?.events ?? []).map((event) => ({
        value: event.key,
        label: t("experiments.goal.namedEvent", { event: event.key }),
      })),
    ],
    [forms.data, stats.data, session.enabledPlugins],
  );
}
