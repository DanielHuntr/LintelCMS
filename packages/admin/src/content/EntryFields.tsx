import type { FieldMessages } from "../api/client.js";
import { innerErrors } from "../fields/blocks/blockValues.js";
import { FieldEditor } from "../fields/FieldEditor.js";
import {
  titleFieldHandle,
  type EntryData,
  type Field,
  type FieldValue,
} from "../fields/field.types.js";

interface EntryFieldsProps {
  fields: readonly Field[];
  data: EntryData;
  errors: FieldMessages;
  onChange: (handle: string, value: FieldValue) => void;
}

/** The blueprint's fields, in its order. The title is drawn separately, as the document's heading. */
export function EntryFields({ fields, data, errors, onChange }: EntryFieldsProps) {
  return (
    <div className="flex flex-col gap-7">
      {fields
        .filter((field) => field.handle !== titleFieldHandle)
        .map((field) => (
          <FieldEditor
            key={field.handle}
            field={field}
            value={data[field.handle]}
            onChange={onChange}
            error={errors[field.handle]}
            innerErrors={innerErrors(errors, field.handle)}
          />
        ))}
    </div>
  );
}
