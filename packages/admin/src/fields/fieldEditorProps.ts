import type { ReactNode } from "react";
import type { FieldMessages } from "../api/client.js";
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
  /**
   * For fields with fields inside (blocks): the API's messages for those, keyed by
   * "<block id>.<inner handle>", and a way to draw them exactly as top-level fields are
   * drawn. Handed in rather than imported, because FieldEditor imports every editor.
   */
  innerErrors: FieldMessages;
  renderField: (props: InnerFieldProps) => ReactNode;
}

/** A field inside another field, such as one field of a block. */
export interface InnerFieldProps {
  field: Field;
  value: unknown;
  onChange: (handle: string, value: FieldValue) => void;
  error?: string;
}
