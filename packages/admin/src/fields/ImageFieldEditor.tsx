import { MediaPicker } from "../media/MediaPicker.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { assetIdValue } from "./fieldValues.js";

/** An image from the media library. The picker itself belongs to the media feature. */
export function ImageFieldEditor({ field, value, onChange }: FieldEditorProps) {
  // The field's own label is already above it, so the picker doesn't repeat it.
  return (
    <MediaPicker value={assetIdValue(value)} onChange={onChange} label={field.label} hideLabel />
  );
}
