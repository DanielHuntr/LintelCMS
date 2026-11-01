import { reduceMotion } from "@lintel/motion";
import type { MotionPreset } from "@lintel/motion/presets";
import { Check } from "lucide-react";
import { classNames } from "../controls/classNames.js";
import { PreviewSample } from "../preview/PreviewSample.js";
import { useMotionPreview } from "../preview/useMotionPreview.js";
import { usePrefersReducedMotion } from "../preview/usePrefersReducedMotion.js";
import { useTranslate } from "../strings/translate.js";

interface PresetCardProps {
  preset: MotionPreset;
  selected: boolean;
  onSelect: (preset: MotionPreset) => void;
}

/**
 * One preset in the gallery. Its preview plays while the pointer is over it or it has focus,
 * so keyboard users see it too. With reduced motion on, the preview plays the reduced version.
 */
export function PresetCard({ preset, selected, onSelect }: PresetCardProps) {
  const t = useTranslate();
  const preview = useMotionPreview(preset.spec);
  const prefersReduced = usePrefersReducedMotion();
  const stillWhenReduced = prefersReduced && reduceMotion(preset.spec) === undefined;
  const descriptionId = `preset-${preset.id}-description`;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-describedby={descriptionId}
      onClick={() => onSelect(preset)}
      onPointerEnter={preview.replay}
      onPointerLeave={preview.reset}
      onFocus={preview.replay}
      onBlur={preview.reset}
      className={classNames(
        "group relative flex flex-col overflow-hidden rounded-card bg-surface text-start hairline-ring",
        "transition duration-150 ease-standard focus-visible:focus-ring",
        selected && "ring-2 ring-accent-fill",
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-28 items-center justify-center overflow-hidden bg-fill/60"
      >
        <PreviewSample sample={preset.preview.sample} rootRef={preview.rootRef} />
      </span>
      <span className="flex flex-col gap-0.5 p-3">
        <span className="flex items-center gap-1.5 text-footnote font-semibold text-label">
          {preset.name}
          {selected && <Check aria-hidden="true" className="size-3.5 text-accent" />}
        </span>
        <span id={descriptionId} className="text-caption text-label-secondary">
          {preset.description}
          {stillWhenReduced && (
            <span className="mt-1 block text-label-tertiary">
              {t("motionEditor.gallery.stillWhenReduced")}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
