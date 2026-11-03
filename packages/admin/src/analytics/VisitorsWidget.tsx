import { formatNumber } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";
import { PluginLink } from "../plugins/PluginLink.js";
import { useVisitorStats } from "./analytics.queries.js";
import { describeChange } from "./visitorLabels.js";

/** The dashboard's small Visitors card: this week's visitors, and how that compares. */
export function VisitorsWidget() {
  const stats = useVisitorStats({ range: "7d" });
  if (!stats.data) return <div className="h-20" aria-busy="true" />;
  const { totals, previousTotals } = stats.data;
  const change = describeChange(totals.visitors, previousTotals.visitors);

  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline gap-2">
        <span className="text-large-title tabular-nums text-label">
          {formatNumber(totals.visitors)}
        </span>
        <span className="text-body text-label-secondary">{t("visitors.widget.thisWeek")}</span>
      </p>
      <p className="text-footnote text-label-secondary">{change.text}</p>
      <PluginLink
        to="/visitors"
        className="mt-2 text-footnote font-medium text-accent hover:underline"
      >
        {t("visitors.widget.seeAll")}
      </PluginLink>
    </div>
  );
}
