import { Card } from "../design/Card.js";
import { formatNumber } from "../i18n/formatting.js";
import type { StatsRow } from "./analytics.api.js";

interface BreakdownCardProps {
  title: string;
  /** The first column's heading: "Page", "Website". */
  keyHeading: string;
  /** The number column's heading: "Visitors", "Reached". */
  valueHeading: string;
  rows: readonly StatsRow[];
  label: (key: string) => string;
  value: (row: StatsRow) => number;
  /** Said when there are no rows; the card is left out when this is missing. */
  emptyText?: string;
  hint?: string;
}

/**
 * One list of the Visitors screen ("Top pages", "Devices"): a real table, each row with a
 * soft bar behind it showing its share, so it reads at a glance and to a screen reader.
 */
export function BreakdownCard({
  title,
  keyHeading,
  valueHeading,
  rows,
  label,
  value,
  emptyText,
  hint,
}: BreakdownCardProps) {
  if (rows.length === 0 && emptyText === undefined) return null;
  const highest = Math.max(1, ...rows.map(value));

  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="text-footnote text-label-secondary">{emptyText}</p>
      ) : (
        <table className="w-full text-body">
          <thead className="sr-only">
            <tr>
              <th scope="col">{keyHeading}</th>
              <th scope="col">{valueHeading}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="w-full max-w-0 py-0.5 pe-3 text-start font-normal">
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 start-0 rounded-[6px] bg-fill"
                      style={{ width: `${Math.max(2, (value(row) / highest) * 100)}%` }}
                    />
                    <span className="relative block truncate px-2 py-1 text-label">
                      {label(row.key)}
                    </span>
                  </div>
                </th>
                <td className="py-1 text-end whitespace-nowrap tabular-nums text-label">
                  {formatNumber(value(row))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hint && <p className="mt-3 text-caption text-label-secondary">{hint}</p>}
    </Card>
  );
}
