import type { MotionSpec } from "@lintel/motion";
import type { PreviewSample as SampleKind } from "@lintel/motion/presets";
import { PreviewSample } from "@lintel/motion-editor";
import { RotateCcw, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../design/Button.js";
import { t } from "../../i18n/strings.js";
import { useMountedMotion } from "./useMountedMotion.js";

/** The spec being edited, playing on a real element with its real trigger. */
export function LiveSample({ spec, sample }: { spec: MotionSpec | null; sample: SampleKind }) {
  const [replayKey, setReplayKey] = useState(0);
  // A pinned scene would stretch this box to several screens tall, so it shows unpinned here.
  const shown = useMemo(
    () =>
      spec?.trigger.type === "scroll" && spec.trigger.pin
        ? { ...spec, trigger: { ...spec.trigger, pin: undefined } }
        : spec,
    [spec],
  );
  const rootRef = useMountedMotion(shown, replayKey);
  const eventName = spec?.trigger.type === "event" ? spec.trigger.name : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-64 items-center justify-center overflow-hidden rounded-panel bg-surface hairline-ring">
        <PreviewSample sample={sample} rootRef={rootRef} size="large" />
      </div>
      <div className="flex gap-2">
        <Button
          variant="tinted"
          size="small"
          icon={<RotateCcw aria-hidden="true" />}
          onClick={() => setReplayKey((key) => key + 1)}
        >
          {t("designReview.motion.replayOnPage")}
        </Button>
        {eventName && (
          <Button
            variant="tinted"
            size="small"
            icon={<Send aria-hidden="true" />}
            onClick={() => document.dispatchEvent(new CustomEvent(eventName))}
          >
            {t("designReview.motion.sendEvent")}
          </Button>
        )}
      </div>
    </div>
  );
}
