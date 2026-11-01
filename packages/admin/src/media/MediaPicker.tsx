import { ImageOff, ImagePlus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { formatDimensions } from "./formatting.js";
import { useAsset } from "./media.queries.js";
import { MediaPickerDialog } from "./MediaPickerDialog.js";

interface MediaPickerProps {
  /** The chosen asset's id, or null when none is chosen. */
  value: string | null;
  onChange: (assetId: string | null) => void;
  /** The field's name, shown above it, e.g. "Hero image". */
  label: string;
  /**
   * Leave the name to screen readers only, for forms that already show it, such as the
   * entry editor's field labels. Shown by default.
   */
  hideLabel?: boolean;
}

/**
 * An image field: shows the chosen image with Replace and Remove, or a "Choose image"
 * button. Both open the library in a dialog, where people can pick or upload in one place.
 */
export function MediaPicker({ value, onChange, label, hideLabel = false }: MediaPickerProps) {
  const labelId = useId();
  const [isChoosing, setIsChoosing] = useState(false);
  const asset = useAsset(value);

  function choose(assetId: string) {
    onChange(assetId);
    setIsChoosing(false);
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className={hideLabel ? "sr-only" : "text-footnote font-medium text-label"}>
        {label}
      </span>

      {value === null ? (
        <button
          type="button"
          onClick={() => setIsChoosing(true)}
          className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-separator bg-fill/50 text-accent transition duration-150 ease-standard hover:bg-fill focus-visible:focus-ring motion-safe:active:scale-[0.99]"
        >
          <ImagePlus aria-hidden="true" strokeWidth={1.75} className="size-6" />
          <span className="text-body font-medium">{t("media.picker.choose")}</span>
        </button>
      ) : (
        <div className="flex items-center gap-4 rounded-card bg-fill/60 p-2.5 pe-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-control bg-fill">
            {asset.data?.thumbnailUrl ? (
              <img
                src={asset.data.thumbnailUrl}
                alt={asset.data.alt}
                className="size-full object-cover"
              />
            ) : asset.isError ? (
              <span className="flex size-full items-center justify-center text-label-tertiary">
                <ImageOff aria-hidden="true" className="size-6" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            {asset.isError ? (
              <p className="text-footnote text-danger">{t("media.picker.missing")}</p>
            ) : (
              <>
                <p className="truncate text-body font-medium text-label">
                  {asset.data?.filename ?? " "}
                </p>
                <p className="truncate text-footnote text-label-secondary">
                  {asset.data && (asset.data.alt ? asset.data.alt : t("media.picker.noAlt"))}
                </p>
                {asset.data && (
                  <p className="text-caption text-label-tertiary">{formatDimensions(asset.data)}</p>
                )}
              </>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button variant="tinted" size="small" onClick={() => setIsChoosing(true)}>
              {t("media.picker.replace")}
            </Button>
            <Button variant="plain" size="small" onClick={() => onChange(null)}>
              {t("media.picker.remove")}
            </Button>
          </div>
        </div>
      )}

      {isChoosing && (
        <MediaPickerDialog
          fieldLabel={label}
          currentAssetId={value}
          onChoose={choose}
          onClose={() => setIsChoosing(false)}
        />
      )}
    </div>
  );
}
