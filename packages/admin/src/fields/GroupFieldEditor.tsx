import type { EntryData } from "./field.types.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { FieldGrid } from "./FieldGrid.js";

/** A group's values (or a fieldset's), as an object keyed by the inner fields' handles. */
export function groupValue(value: unknown): EntryData {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as EntryData)
    : {};
}

/**
 * A few fields kept together under one name, such as an address: drawn in a panel on the
 * same grid as the entry's own fields. A Fieldset field is drawn the same way.
 */
export function GroupFieldEditor({
  field,
  value,
  onChange,
  innerErrors,
  renderField,
}: FieldEditorProps) {
  const values = groupValue(value);
  return (
    <div className="rounded-card bg-fill/40 p-4 hairline-ring">
      <FieldGrid
        fields={field.options.fields ?? []}
        data={values}
        errors={innerErrors}
        onChange={(handle, innerValue) => onChange({ ...values, [handle]: innerValue })}
        renderField={renderField}
        handlePrefix={field.handle}
      />
    </div>
  );
}
