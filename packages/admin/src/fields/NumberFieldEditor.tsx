import { useState } from "react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { numberFromInput, numberValue } from "./fieldValues.js";

/** A number, limited by the field's min, max and step. Clearing it stores empty, not 0. */
export function NumberFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const stored = numberValue(value);
  // Keep the typed text, so half-typed numbers such as "-" or "1." aren't wiped out.
  const [text, setText] = useState(stored === null ? "" : String(stored));
  const { min, max, step } = field.options;

  return (
    <input
      id={controlId}
      placeholder={field.placeholder}
      type="number"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step ?? "any"}
      onChange={(event) => {
        setText(event.target.value);
        onChange(numberFromInput(event.target.value));
      }}
      aria-required={field.required || undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
      className={classNames("h-10 max-w-48 tabular-nums", controlClasses({ hasError }))}
    />
  );
}
