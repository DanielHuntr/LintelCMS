import type { NodeAnimation, NodeEffect, PageNode } from "@lintel/builder-model";
import type { MotionSpec } from "@lintel/motion";
import { effectAnimation, type EffectBinding, type PageWeight } from "@lintel/motion/effects";
import {
  EffectsPanel,
  MotionStudio,
  type StudioView,
  type Translate as MotionText,
} from "@lintel/motion-editor";
import { Play, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { usePreferenceStore } from "../preferences/builder-preferences.js";
import { useRememberedOpenSections } from "../preferences/open-sections.js";
import { Tip } from "../tour/Tip.js";
import { elementKindOf } from "./element-kinds.js";

export type EffectPreview = Pick<EffectBinding, "module" | "behaviour" | "params">;

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
  onChangeEffects: (effects: NodeEffect[]) => void;
  /** Plays a spec on the element on the canvas. */
  onPreview: (spec: MotionSpec) => void;
  /** Runs an effect on the element on the canvas until the preview stops (null). */
  onPreviewEffect: (effect: EffectPreview | null) => void;
  /** Where each effect module is served, for previews. Without it, effects aren't previewed. */
  effectModules?: Readonly<Record<string, string>>;
  /** The whole page's effects added up. */
  pageWeight?: PageWeight;
  tips: { isDismissed: (tip: string) => boolean; dismiss: (tip: string) => void };
}

const beginnerViews: readonly StudioView[] = ["gallery", "simple"];
const allViews: readonly StudioView[] = ["gallery", "simple", "advanced"];
type Tab = "animation" | "effects";

/**
 * How the selected element moves: its animation (the studio from `@lintel/motion-editor`)
 * and its effects (the Effects gallery). Every change is saved on the element and played
 * on the canvas, so people see the real thing on their own page rather than on a sample.
 */
export function AnimatePanel({
  node,
  name,
  isLocked,
  showsTimeline,
  motionText,
  onChange,
  onChangeEffects,
  onPreview,
  onPreviewEffect,
  effectModules,
  pageWeight,
  tips,
}: AnimatePanelProps) {
  const text = useBuilderText();
  const animation = node.animation;
  const [tab, setTab] = useState<Tab>(node.effects?.length && !animation ? "effects" : "animation");
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

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "animation", label: text("pageBuilder.animate.tab.animation") },
    { value: "effects", label: text("pageBuilder.animate.tab.effects") },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div
        role="group"
        aria-label={text("pageBuilder.animate.tabs")}
        className="flex rounded-control bg-fill p-0.5"
      >
        {tabs.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={tab === option.value}
            onClick={() => {
              onPreviewEffect(null);
              setTab(option.value);
            }}
            className="h-7 flex-1 rounded-[calc(var(--radius-control)-2px)] text-footnote font-medium text-label-secondary focus-visible:focus-ring aria-pressed:bg-surface aria-pressed:text-label aria-pressed:shadow-float"
          >
            {option.label}
          </button>
        ))}
      </div>
      {tab === "effects" ? (
        <>
          <h2 className="min-w-0 truncate text-footnote font-semibold text-label">
            {text("pageBuilder.animate.effectsHeading", { name })}
          </h2>
          <EffectsPanel
            key={node.id}
            effects={node.effects ?? []}
            elementKind={elementKindOf(node.type)}
            onChange={onChangeEffects}
            onApplyAnimation={(definition, props) => {
              const spec = effectAnimation(definition, props);
              onChange({ spec, presetId: definition.id });
              onPreview(spec);
              setTab("animation");
            }}
            onPreview={(definition, props) => {
              if (definition.kind === "behaviour") {
                onPreviewEffect({
                  module: definition.module,
                  behaviour: definition.module === "custom" ? definition.id : definition.behaviour,
                  params: { ...definition.fixed, ...props },
                });
              } else if (definition.kind === "animation") {
                onPreview(effectAnimation(definition, props));
              }
            }}
            onStopPreview={() => onPreviewEffect(null)}
            pageWeight={pageWeight}
            moduleAddresses={effectModules}
            translate={motionText}
          />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="min-w-0 truncate text-footnote font-semibold text-label">
              {text("pageBuilder.animate.heading", { name })}
            </h2>
            {animation && (
              <div className="-ms-2 flex flex-wrap gap-1">
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
            key={`${node.id}:${animation ? "animated" : "still"}:${animation?.presetId ?? ""}`}
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
        </>
      )}
    </div>
  );
}
