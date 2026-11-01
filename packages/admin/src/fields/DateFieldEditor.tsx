import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { dateFromInput, dateInputValue } from "./dateValues.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";

/** A date, or a date and time when the field has `includeTime`. Uses the browser's own picker. */
export function DateFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const includeTime = field.options.includeTime === true;

  return (
    <input
      id={controlId}
      type={includeTime ? "datetime-local" : "date"}
      value={dateInputValue(value, includeTime)}
      onChange={(event) => onChange(dateFromInput(event.target.value, includeTime))}
      aria-required={field.required || undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
      className={classNames("h-10 max-w-64 tabular-nums", controlClasses({ hasError }))}
    />
  );
}
