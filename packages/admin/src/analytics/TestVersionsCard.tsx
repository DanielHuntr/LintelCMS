import { useMemo } from "react";
import { versionName } from "../experiments/experimentText.js";
import { useExperiments } from "../experiments/experiments.queries.js";
import type { VersionKey } from "../experiments/experiments.types.js";
import { t } from "../i18n/strings.js";
import { useCan, useSession } from "../session/SessionContext.js";
import type { StatsRow } from "./analytics.api.js";
import { BreakdownCard } from "./BreakdownCard.js";

/**
 * "A/B tests running": the visitors who saw each version of each running test, from the page
 * views Visitors tagged with the version shown. Only for people who can see tests, while
 * a test runs and has visitors; the results themselves stay on the test's own screen.
 */
export function TestVersionsCard({ rows }: { rows: readonly StatsRow[] }) {
  const session = useSession();
  const canSeeTests =
    useCan("experiments:manage") && session.enabledPlugins.includes("experiments");
  const experiments = useExperiments(canSeeTests && rows.length > 0);

  const shown = useMemo(() => {
    const running = (experiments.data ?? []).filter(
      (experiment) => experiment.status === "running",
    );
    const labels = new Map<string, string>();
    const ordered: StatsRow[] = [];
    for (const experiment of running) {
      for (const key of ["original", ...experiment.versions.map((version) => version.key)]) {
        const row = rows.find((candidate) => candidate.key === `${experiment.id}:${key}`);
        if (!row) continue;
        labels.set(
          row.key,
          t("visitors.tests.version", {
            page: experiment.pageTitle || t("experiments.list.untitled"),
            version: versionName(key as VersionKey),
          }),
        );
        ordered.push(row);
      }
    }
    return { rows: ordered, labels };
  }, [experiments.data, rows]);

  if (!canSeeTests) return null;
  return (
    <BreakdownCard
      title={t("visitors.tests")}
      keyHeading={t("visitors.column.version")}
      valueHeading={t("visitors.column.visitors")}
      rows={shown.rows}
      label={(key) => shown.labels.get(key) ?? key}
      value={(row) => row.visitors}
      hint={t("visitors.tests.hint")}
    />
  );
}
