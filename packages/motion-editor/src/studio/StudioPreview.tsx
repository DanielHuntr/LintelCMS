import type { MotionSpec } from "@lintel/motion";
import type { PreviewSample as SampleKind } from "@lintel/motion/presets";
import { RotateCcw } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { Button } from "../controls/Button.js";
import { Checkbox } from "../controls/Field.js";
import { PreviewSample } from "../preview/PreviewSample.js";
import { useMotionPreview } from "../preview/useMotionPreview.js";
import { usePrefersReducedMotion } from "../preview/usePrefersReducedMotion.js";
import { useTranslate } from "../strings/translate.js";

interface StudioPreviewProps {
  spec: MotionSpec;
  sample: SampleKind;
  /** Filled in with the preview's replay and seek, for the panels below to call. */
  replayRef: RefObject<() => void>;
  seekRef: RefObject<(milliseconds: number) => void>;
}

/** The stage: a large sample playing the animation, with a switch to see the reduced-motion version. */
export function StudioPreview({ spec, sample, replayRef, seekRef }: StudioPreviewProps) {
  const t = useTranslate();
  const devicePrefersReduced = usePrefersReducedMotion();
  const [previewReduced, setPreviewReduced] = useState(false);
  const preview = useMotionPreview(
    spec,
    previewReduced || devicePrefersReduced ? "reduce" : "no-preference",
  );

  useEffect(() => {
    replayRef.current = preview.replay;
    seekRef.current = preview.seekTime;
  }, [preview.replay, preview.seekTime, replayRef, seekRef]);

  return (
    <section aria-label={t("motionEditor.preview.title")} className="flex flex-col gap-2">
      <div
        aria-hidden="true"
        className="relative flex h-56 items-center justify-center overflow-hidden rounded-panel bg-fill/70"
      >
        <PreviewSample sample={sample} rootRef={preview.rootRef} size="large" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={<RotateCcw aria-hidden="true" />} onClick={preview.replay}>
          {t("motionEditor.preview.replay")}
        </Button>
        {devicePrefersReduced ? (
          <p className="text-caption text-label-secondary">
            {t("motionEditor.preview.deviceReduced")}
          </p>
        ) : (
          <Checkbox
            label={t("motionEditor.preview.showReduced")}
            checked={previewReduced}
            onChange={setPreviewReduced}
          />
        )}
        {preview.reduced && (
          <p role="status" className="ms-auto text-caption text-label-secondary">
            {t("motionEditor.preview.showingReduced")}
          </p>
        )}
      </div>
    </section>
  );
}
