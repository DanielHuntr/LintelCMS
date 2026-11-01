import { Toggle } from "../design/Toggle.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { booleanValue } from "./fieldValues.js";

/** An on/off switch. The shell shows the field's label beside it. */
export function ToggleFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
}: FieldEditorProps) {
  return (
    <Toggle
      id={controlId}
      label={field.label}
      labelVisibility="hidden"
      checked={booleanValue(value)}
      onCheckedChange={onChange}
      describedBy={describedBy}
    />
  );
}
