import { PanelSection } from "../content/PanelSection.js";
import { PluginLink } from "../plugins/PluginLink.js";
import { t } from "../i18n/strings.js";
import type { EditorPanelProps } from "../plugins/adminPlugin.js";
import { useEntryVisitorStats } from "./analytics.queries.js";
import { describeChange, formatSeconds } from "./visitorLabels.js";

/** The entry editor's "Visitors" panel: this page's last seven days, in one or two lines. */
export function EntryVisitorsPanel({ entryId }: EditorPanelProps) {
  const stats = useEntryVisitorStats(entryId);
  if (entryId === undefined || !stats.data) return null;
  const { totals, previousTotals, path } = stats.data;

  return (
    <PanelSection title={t("visitors.panel.title")}>
      {path === null ? (
        <p className="text-footnote text-label-secondary">{t("visitors.panel.noPage")}</p>
      ) : (
        <div className="flex flex-col gap-1 text-footnote">
          <p className="text-body text-label">
            {t("visitors.panel.week", { visitors: totals.visitors })}
          </p>
          <p className="text-label-secondary">
            {t("visitors.panel.views", { views: totals.views })}
            {totals.averageSeconds !== null && ` · ${formatSeconds(totals.averageSeconds)}`}
          </p>
          <p className="text-label-secondary">
            {describeChange(totals.visitors, previousTotals.visitors).text}
          </p>
          <PluginLink to="/visitors" className="mt-1 font-medium text-accent hover:underline">
            {t("visitors.widget.seeAll")}
          </PluginLink>
        </div>
      )}
    </PanelSection>
  );
}
