import { useId } from "react";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import type { OrderLine } from "./orders.api.js";

interface LineQuantityFieldsProps {
  legend: string;
  lines: OrderLine[];
  /** The most of each line that can be chosen, by line id. */
  maximums: Record<string, number>;
  quantities: Record<string, number>;
  onChange: (quantities: Record<string, number>) => void;
}

/** "How many of each?" for refunding or sending part of an order. */
export function LineQuantityFields({
  legend,
  lines,
  maximums,
  quantities,
  onChange,
}: LineQuantityFieldsProps) {
  const baseId = useId();
  const choosable = lines.filter((line) => (maximums[line.id] ?? 0) > 0);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-footnote font-medium text-label">{legend}</legend>
      {choosable.map((line) => {
        const inputId = `${baseId}-${line.id}`;
        const maximum = maximums[line.id] ?? 0;
        return (
          <div key={line.id} className="flex items-center justify-between gap-4">
            <label htmlFor={inputId} className="min-w-0 text-body text-label">
              {line.productTitle}
              {line.variantTitle !== "Default" && (
                <span className="block text-footnote text-label-secondary">
                  {line.variantTitle}
                </span>
              )}
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={0}
                max={maximum}
                value={quantities[line.id] ?? 0}
                onChange={(event) => {
                  const typed = Math.floor(Number(event.target.value));
                  const quantity = Number.isFinite(typed)
                    ? Math.min(maximum, Math.max(0, typed))
                    : 0;
                  onChange({ ...quantities, [line.id]: quantity });
                }}
                className={`${controlClasses()} h-9 w-20 text-right`}
              />
              <span className="text-footnote text-label-secondary">
                {t("shop.orders.ofMaximum", { maximum })}
              </span>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

export function chosenLines(quantities: Record<string, number>) {
  return Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
}
