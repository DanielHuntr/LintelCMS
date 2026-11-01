import { ImageIcon, X } from "lucide-react";
import { t } from "../i18n/strings.js";

export interface MediaPickerProps {
  /** The chosen asset's id, or null when no image is chosen. */
  value: string | null;
  onChange: (assetId: string | null) => void;
  /** The field's label, used to name the picker's buttons for screen readers. */
  label: string;
}

/**
 * Placeholder. The media feature replaces this file with the real picker (library, upload,
 * focal point), keeping exactly these props, so image fields need no change when it lands.
 * Until then it shows whether an image is set and lets people remove it.
 */
export function MediaPicker({ value, onChange, label }: MediaPickerProps) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-fill/60 p-3">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-control bg-fill text-label-tertiary">
        <ImageIcon aria-hidden="true" strokeWidth={1.5} className="size-6" />
      </span>
      <p className="min-w-0 flex-1 text-footnote text-label-secondary">
        {value ? t("media.picker.chosen") : t("media.picker.comingSoon")}
      </p>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t("media.picker.remove", { label })}
          className="flex size-8 items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
        >
          <X aria-hidden="true" strokeWidth={2} className="size-4" />
        </button>
      )}
    </div>
  );
}
