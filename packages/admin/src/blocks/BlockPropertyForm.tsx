import type { BlockPropertyForm as BlockPropertyFormProps } from "@lintel/builder";
import { FieldEditor } from "../fields/FieldEditor.js";
import { FieldGrid } from "../fields/FieldGrid.js";
import type { Field } from "../fields/field.types.js";

/**
 * A block instance's form in the builder: its properties drawn by the same field editors,
 * widths and conditions as an entry's fields, so filling in a block feels like filling in
 * any content. The server checks the values again when the page is saved.
 */
export function BlockPropertyForm({ block, values, onChange }: BlockPropertyFormProps) {
  return (
    <FieldGrid
      fields={block.properties as unknown as Field[]}
      data={values}
      errors={{}}
      onChange={(handle, value) => onChange({ ...values, [handle]: value })}
      renderField={(props) => <FieldEditor {...props} />}
      className="gap-y-5"
    />
  );
}
