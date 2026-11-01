import type { Field, FieldValue } from "./field.types.js";

/** What every field editor receives from `FieldEditor`. */
export interface FieldEditorProps {
  field: Field;
  /** The stored value, untyped: read it with a helper from fieldValues.ts. */
  value: unknown;
  onChange: (value: FieldValue) => void;
  /** Put this on the main control, so the visible label points at it and errors can focus it. */
  controlId: string;
  /** The visible label's id, for controls a `<label>` can't name (the rich text editor). */
  labelId: string;
  /** Help text and error message ids, for `aria-describedby`. */
  describedBy: string | undefined;
  hasError: boolean;
}
