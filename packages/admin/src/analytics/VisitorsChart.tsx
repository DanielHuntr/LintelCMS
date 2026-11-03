import { useState } from "react";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { formatNumber } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";
import type { DayFigures } from "./analytics.api.js";
import { dayLabel } from "./visitorLabels.js";

/**
 * Visitors each day, as quiet bars with a one-sentence summary for screen readers, and the
 * same figures as a table for anyone who prefers one (one click away, never hidden).
 */
export function VisitorsChart({ days }: { days: readonly DayFigures[] }) {
  const [asTable, setAsTable] = useState(false);
  const highest = Math.max(1, ...days.map((day) => day.visitors));
  const total = days.reduce((sum, day) => sum + day.visitors, 0);
  const busiest = days.reduce<DayFigures | undefined>(
    (best, day) => (best === undefined || day.visitors > best.visitors ? day : best),
    undefined,
  );
  const first = days[0];
  const last = days.at(-1);
  const summary =
    first && last && busiest
      ? t("visitors.chart.summary", {
          visitors: total,
          from: dayLabel(first.day),
          to: dayLabel(last.day),
          busiest: dayLabel(busiest.day),
        })
      : "";

  return (
    <Card
      title={t("visitors.chart.title")}
      accessory={
        <Button variant="plain" size="small" onClick={() => setAsTable((shown) => !shown)}>
          {asTable ? t("visitors.chart.showChart") : t("visitors.chart.showTable")}
        </Button>
      }
    >
      {asTable ? (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="text-footnote text-label-secondary">
                <th scope="col" className="py-1.5 text-start font-medium">
                  {t("visitors.chart.day")}
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  {t("visitors.visitors")}
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  {t("visitors.views")}
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.day} className="border-t border-separator">
                  <th scope="row" className="py-1.5 text-start font-normal text-label">
                    {dayLabel(day.day)}
                  </th>
                  <td className="py-1.5 text-end tabular-nums">{formatNumber(day.visitors)}</td>
                  <td className="py-1.5 text-end tabular-nums text-label-secondary">
                    {formatNumber(day.views)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <figure>
          <div role="img" aria-label={summary} className="flex h-40 items-end gap-[3px]">
            {days.map((day) => (
              <div
                key={day.day}
                title={`${dayLabel(day.day)}: ${formatNumber(day.visitors)}`}
                className="flex h-full min-w-0 flex-1 items-end justify-center"
              >
                <div
                  className="w-full max-w-10 rounded-t-[4px] bg-accent/45"
                  style={{
                    height: `${Math.max(day.visitors > 0 ? 3 : 1, (day.visitors / highest) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          {first && last && (
            <figcaption className="mt-2 flex justify-between text-caption text-label-secondary">
              <span>{dayLabel(first.day)}</span>
              {days.length > 1 && <span>{dayLabel(last.day)}</span>}
            </figcaption>
          )}
        </figure>
      )}
    </Card>
  );
}
