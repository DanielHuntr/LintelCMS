import { MediaPicker } from "../media/MediaPicker.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { assetIdValue } from "./fieldValues.js";

/** An image from the media library. The picker itself belongs to the media feature. */
export function ImageFieldEditor({ field, value, onChange }: FieldEditorProps) {
  return <MediaPicker value={assetIdValue(value)} onChange={onChange} label={field.label} />;
}
