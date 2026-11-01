import { useRef, type KeyboardEvent } from "react";
import { classNames } from "../design/classNames.js";
import { radioGroupTargetIndex } from "../design/radioGroupKeys.js";
import { fieldWidths, type FieldWidth } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";

interface WidthPickerProps {
  value: FieldWidth;
  onChange: (width: FieldWidth) => void;
}

/**
 * How wide a field is, picked from pictures of a row: each option draws its share of the row
 * filled in, with the percentage under it. A radio group, so the arrow keys move the choice.
 */
export function WidthPicker({ value, onChange }: WidthPickerProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = radioGroupTargetIndex(event.key, index, fieldWidths.length);
    const width = target === undefined ? undefined : fieldWidths[target];
    if (target === undefined || width === undefined) return;
    event.preventDefault();
    onChange(width);
    buttons.current[target]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("fieldSettings.width")}
      className="grid grid-cols-3 gap-2 sm:grid-cols-6"
    >
      {fieldWidths.map((width, index) => {
        const isSelected = width === value;
        return (
          <button
            key={width}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={t("fieldSettings.widthOption", { width })}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(width)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={classNames(
              "flex flex-col items-center gap-1.5 rounded-control p-2 transition-colors duration-150 ease-standard focus-visible:focus-ring",
              isSelected ? "bg-accent/12 text-accent" : "text-label-secondary hover:bg-fill",
            )}
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-full overflow-hidden rounded-[5px] bg-fill"
            >
              <span
                className={classNames(
                  "h-full rounded-[5px]",
                  isSelected ? "bg-accent" : "bg-label-tertiary/60",
                )}
                style={{ width: `${width === 33 ? 33.33 : width === 66 ? 66.67 : width}%` }}
              />
            </span>
            <span className="text-caption font-medium tabular-nums">{width}%</span>
          </button>
        );
      })}
    </div>
  );
}
