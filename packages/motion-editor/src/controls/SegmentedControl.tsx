import { useRef, type KeyboardEvent } from "react";
import { classNames } from "./classNames.js";

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

interface SegmentedControlProps<Value extends string> {
  label: string;
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

const keySteps: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

/** A pill of exclusive choices: a radio group, where the arrow keys move the choice. */
export function SegmentedControl<Value extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<Value>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const step = keySteps[event.key];
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : step === undefined
            ? undefined
            : (index + step + options.length) % options.length;
    const option = target === undefined ? undefined : options[target];
    if (!option || target === undefined) return;
    event.preventDefault();
    onChange(option.value);
    buttons.current[target]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-fit max-w-full flex-wrap rounded-full bg-fill p-0.5"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={classNames(
              "h-7 rounded-full px-3 text-footnote font-medium whitespace-nowrap",
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
