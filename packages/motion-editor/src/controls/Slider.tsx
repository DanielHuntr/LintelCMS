import { useId } from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Words at each end, e.g. "Slower" and "Faster", so the slider needs no numbers. */
  minLabel?: string;
  maxLabel?: string;
  /** What screen readers hear for the value, e.g. "1.5 times as fast". */
  valueText?: string;
  /** Shown beside the label. */
  displayValue?: string;
  /** Called when a drag or key press ends, so undo can treat the drag as one change. */
  onCommit?: () => void;
}

/** A labelled native range input: keyboard, screen readers and touch work as the platform does. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  minLabel,
  maxLabel,
  valueText,
  displayValue,
  onCommit,
}: SliderProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-footnote font-medium text-label">
          {label}
        </label>
        {displayValue && (
          <span className="text-caption text-label-secondary tabular-nums">{displayValue}</span>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="w-full accent-accent-fill focus-visible:focus-ring"
      />
      {(minLabel || maxLabel) && (
        <div
          aria-hidden="true"
          className="flex justify-between gap-3 text-caption text-label-tertiary"
        >
          <span>{minLabel}</span>
          <span className="text-end">{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
