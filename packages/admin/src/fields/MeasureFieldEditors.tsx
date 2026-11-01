import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { numberValue, textValue } from "./fieldValues.js";

/** A slider with its number beside it, and a time of day. */

export function RangeFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
}: FieldEditorProps) {
  const min = field.options.min ?? 0;
  const max = field.options.max ?? 100;
  const step = field.options.step ?? 1;
  const current = numberValue(value);
  const suffix = field.options.suffix ?? "";
  return (
    <div className="flex items-center gap-3">
      <input
        id={controlId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current ?? min}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-describedby={describedBy}
        aria-valuetext={current === null ? undefined : `${current}${suffix}`}
        className="h-6 min-w-0 flex-1 accent-accent-fill"
      />
      <output
        htmlFor={controlId}
        className="min-w-14 rounded-control bg-fill px-2 py-1 text-center text-footnote text-label tabular-nums"
      >
        {current === null ? "–" : `${current}${suffix}`}
      </output>
    </div>
  );
}

export function TimeFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  return (
    <input
      id={controlId}
      type="time"
      value={textValue(value)}
      onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      aria-required={field.required || undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
      className={classNames("h-10 max-w-40", controlClasses({ hasError }))}
    />
  );
}
