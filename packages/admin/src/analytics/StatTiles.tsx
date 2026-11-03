import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { formatNumber } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";
import type { Totals } from "./analytics.api.js";
import { describeChange, formatPercent, formatSeconds } from "./visitorLabels.js";

/** The four headline figures, each with how it compares with the period before. */
export function StatTiles({ totals, previous }: { totals: Totals; previous: Totals }) {
  const tiles = [
    {
      label: t("visitors.visitors"),
      value: formatNumber(totals.visitors),
      change: describeChange(totals.visitors, previous.visitors),
    },
    {
      label: t("visitors.views"),
      value: formatNumber(totals.views),
      change: describeChange(totals.views, previous.views),
    },
    {
      label: t("visitors.averageTime"),
      value: formatSeconds(totals.averageSeconds),
      change: describeChange(totals.averageSeconds ?? 0, previous.averageSeconds ?? 0),
    },
    {
      label: t("visitors.conversionRate"),
      value: formatPercent(totals.conversionRate),
      change: describeChange(totals.conversionRate ?? 0, previous.conversionRate ?? 0),
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="flex flex-col rounded-card bg-surface p-4">
          <dt className="text-footnote text-label-secondary">{tile.label}</dt>
          <dd className="mt-1 text-title tabular-nums text-label">{tile.value}</dd>
          <dd
            className={classNames(
              "mt-1 flex items-start gap-1 text-caption",
              tile.change.direction === "up" && "text-success",
              tile.change.direction === "down" && "text-danger",
              (tile.change.direction === "same" || tile.change.direction === "new") &&
                "text-label-secondary",
            )}
          >
            {tile.change.direction === "up" && (
              <ArrowUpRight aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            )}
            {tile.change.direction === "down" && (
              <ArrowDownRight aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            )}
            {tile.change.text}
          </dd>
        </div>
      ))}
    </dl>
  );
}
