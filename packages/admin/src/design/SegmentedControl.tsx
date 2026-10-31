import { useRef, type KeyboardEvent } from "react";
import { classNames } from "./classNames.js";
import { radioGroupTargetIndex } from "./radioGroupKeys.js";

export interface SegmentedControlOption<Value extends string> {
  value: Value;
  label: string;
}

interface SegmentedControlProps<Value extends string> {
  /** Read by screen readers to say what the choice is about, e.g. "Show orders". */
  label: string;
  options: readonly SegmentedControlOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

/**
 * A pill of mutually exclusive choices. It behaves as a radio group: Tab moves into it once,
 * and the arrow keys (plus Home and End) move the selection, wrapping at the ends.
 */
export function SegmentedControl<Value extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<Value>) {
  const optionElements = useRef<Array<HTMLButtonElement | null>>([]);

  function selectOptionAt(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    optionElements.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const targetIndex = radioGroupTargetIndex(event.key, index, options.length);
    if (targetIndex === undefined) return;
    event.preventDefault();
    selectOptionAt(targetIndex);
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-fit rounded-full bg-fill p-0.5"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              optionElements.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            // Only the selected option is a tab stop; the arrow keys reach the others.
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={classNames(
              "h-7 min-w-16 rounded-full px-3.5 text-footnote font-medium whitespace-nowrap",
              "transition duration-200 ease-standard focus-visible:focus-ring",
              isSelected
                ? "bg-segment text-label shadow-thumb"
                : "text-label-secondary hover:text-label",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
