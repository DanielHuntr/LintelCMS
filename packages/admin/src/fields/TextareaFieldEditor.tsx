import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { textValue } from "./fieldValues.js";

/** Several lines of plain text, such as a summary. Grows with its content. */
export function TextareaFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  return (
    <textarea
      id={controlId}
      value={textValue(value)}
      rows={3}
      maxLength={field.options.maxLength}
      onChange={(event) => onChange(event.target.value)}
      aria-required={field.required || undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
      // field-sizing lets the box grow with the text in browsers that support it.
      className={classNames(
        "min-h-20 resize-y py-2 [field-sizing:content]",
        controlClasses({ hasError }),
      )}
    />
  );
}
