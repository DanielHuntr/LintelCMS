import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { textValue } from "./fieldValues.js";

/** A single line of text. `maxLength` stops typing at the limit; the shell shows the count. */
export function TextFieldEditor({
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
      placeholder={field.placeholder}
      type="text"
      value={textValue(value)}
      maxLength={field.options.maxLength}
      onChange={(event) => onChange(event.target.value)}
      aria-required={field.required || undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
      className={classNames("h-10", controlClasses({ hasError }))}
    />
  );
}
