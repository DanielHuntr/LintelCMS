import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { textValue } from "./fieldValues.js";

/** An email address. The browser's email keyboard appears on phones. */
export function EmailFieldEditor({
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
      type="email"
      inputMode="email"
      autoComplete="off"
      spellCheck={false}
      placeholder={field.placeholder || t("fields.email.placeholder")}
      value={textValue(value)}
      onChange={(event) => onChange(event.target.value)}
      aria-required={field.required || undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
      className={classNames("h-10 max-w-md", controlClasses({ hasError }))}
    />
  );
}
