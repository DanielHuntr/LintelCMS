import type { NodeAnimation, PageNode } from "@lintel/builder-model";
import type { MotionSpec } from "@lintel/motion";
import { MotionStudio, type StudioView, type Translate as MotionText } from "@lintel/motion-editor";
import { Play, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { usePreferenceStore } from "../preferences/builder-preferences.js";
import { useRememberedOpenSections } from "../preferences/open-sections.js";
import { Tip } from "../tour/Tip.js";

interface AnimatePanelProps {
  node: PageNode;
  /** The element's name in Layers, for the heading. */
  name: string;
  isLocked: boolean;
  /** Whether the timeline (the studio's Advanced view) is on offer. */
  showsTimeline: boolean;
  /** The app's words for the studio; English when left out. */
  motionText?: MotionText;
  onChange: (animation: NodeAnimation | null) => void;
  /** Plays a spec on the element on the canvas. */
  onPreview: (spec: MotionSpec) => void;
  tips: { isDismissed: (tip: string) => boolean; dismiss: (tip: string) => void };
}

const beginnerViews: readonly StudioView[] = ["gallery", "simple"];
const allViews: readonly StudioView[] = ["gallery", "simple", "advanced"];

/**
 * How the selected element moves: the animation studio from `@lintel/motion-editor`, with
 * every change saved on the element and played on the canvas, so people see the real thing
 * on their own page rather than on a sample.
 */
export function AnimatePanel({
  node,
  name,
  isLocked,
  showsTimeline,
  motionText,
  onChange,
  onPreview,
  tips,
}: AnimatePanelProps) {
  const text = useBuilderText();
  const animation = node.animation;
  // Simple's groups (when it plays, timing, less motion), remembered like the Style panel's.
  const openGroups = useRememberedOpenSections(usePreferenceStore(), "animate.open", [
    "trigger",
    "timing",
  ]);
  const change = useCallback(
    (spec: MotionSpec, presetId: string | undefined) => {
      onChange(presetId ? { spec, presetId } : { spec });
      onPreview(spec);
    },
    [onChange, onPreview],
  );

  if (isLocked) {
    return (
      <p className="px-4 py-6 text-footnote text-warning">
        {text("pageBuilder.animate.lockedNote")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="min-w-0 truncate text-footnote font-semibold text-label">
          {text("pageBuilder.animate.heading", { name })}
        </h2>
        {animation && (
          <div className="-ml-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onPreview(animation.spec)}
              className="flex h-8 items-center gap-1.5 rounded-control px-2 text-footnote font-medium whitespace-nowrap text-accent hover:bg-fill focus-visible:focus-ring"
            >
              <Play aria-hidden="true" className="size-4" />
              {text("pageBuilder.animate.playOnPage")}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex h-8 items-center gap-1.5 rounded-control px-2 text-footnote font-medium whitespace-nowrap text-danger hover:bg-fill focus-visible:focus-ring"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              {text("pageBuilder.animate.remove")}
            </button>
          </div>
        )}
      </div>
      <Tip id="animate" tips={tips}>
        {text("pageBuilder.animate.tip")}
      </Tip>
      <MotionStudio
        // A different element, or its animation removed, starts the studio afresh.
        key={`${node.id}:${animation ? "animated" : "still"}`}
        initialSpec={animation?.spec ?? null}
        initialPresetId={animation?.presetId}
        onChange={change}
        translate={motionText}
        views={showsTimeline ? allViews : beginnerViews}
        openGroups={openGroups}
      />
      {!showsTimeline && animation && (
        <p className="text-caption text-label-secondary">
          {text("pageBuilder.animate.timelineInDesigner")}
        </p>
      )}
    </div>
  );
}
