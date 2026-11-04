import type { NodeAnimation, NodeEffect, PageNode } from "@lintel/builder-model";
import type { MotionSpec } from "@lintel/motion";
import type { EffectBinding, PageWeight } from "@lintel/motion/effects";
import { MotionPanel, type Translate as MotionText } from "@lintel/motion-editor";
import { useBuilderText } from "../i18n/builder-text.js";
import { usePreferenceStore } from "../preferences/builder-preferences.js";
import { useRememberedOpenSections } from "../preferences/open-sections.js";
import type { ImagePicker } from "../panels/content-fields.js";
import { Tip } from "../tour/Tip.js";
import { useCursorColourSwatches } from "./cursor-colours.js";
import { elementKindOf } from "./element-kinds.js";
import { pointerFieldEffectIds, PointerFields } from "./PointerFields.js";

export type EffectPreview = Pick<EffectBinding, "module" | "behaviour" | "params">;

interface AnimatePanelProps {
  node: PageNode;
  /** The element's name in Layers, for the heading. */
  name: string;
  isLocked: boolean;
  /** The app's words for the studio; English when left out. */
  motionText?: MotionText;
  onChange: (animations: NodeAnimation[]) => void;
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
  /** Elements around this one whose scroll scenes it can be a step of, nearest first. */
  sceneElements?: ReadonlyArray<{ id: string; name: string }>;
  /** Opens the media library, for the picture shown on hover. */
  pickImage?: ImagePicker;
  /** Whether the site has a custom cursor, which "The cursor grows" needs. */
  siteCursorOn?: boolean;
}

/**
 * How the selected element moves: the Motion panel from `@lintel/motion-editor`, with its
 * animation and effects in one list, added by choosing when it should move. Every change
 * is saved on the element and played on the canvas, so people see the real thing on their
 * own page rather than on a sample.
 */
export function AnimatePanel({
  node,
  name,
  isLocked,
  motionText,
  onChange,
  onChangeEffects,
  onPreview,
  onPreviewEffect,
  pageWeight,
  sceneElements,
  pickImage,
  tips,
  siteCursorOn,
}: AnimatePanelProps) {
  const text = useBuilderText();
  // The site's colours, offered for backgrounds' and other effects' colour settings.
  const colours = useCursorColourSwatches();
  // Simple's groups (when it plays, timing, less motion), remembered like the Style panel's.
  const openGroups = useRememberedOpenSections(usePreferenceStore(), "animate.open", [
    "trigger",
    "timing",
  ]);

  if (isLocked) {
    return (
      <p className="px-4 py-6 text-footnote text-warning">
        {text("pageBuilder.animate.lockedNote")}
      </p>
    );
  }

  // The word on the cursor and the hover picture have fields of their own below.
  const allEffects = node.effects ?? [];
  const pointerEffects = allEffects.filter((effect) => pointerFieldEffectIds.has(effect.effect));
  const listedEffects = allEffects.filter((effect) => !pointerFieldEffectIds.has(effect.effect));

  return (
    <div>
      <div className="flex flex-col gap-3 p-4">
        <Tip id="animateHowTo" tips={tips}>
          {text("pageBuilder.animate.howTo")}
        </Tip>
        <MotionPanel
          key={node.id}
          name={name}
          animations={node.animations ?? []}
          effects={listedEffects}
          elementKind={elementKindOf(node.type)}
          onChangeAnimations={onChange}
          onChangeEffects={(effects) => onChangeEffects([...effects, ...pointerEffects])}
          onPreviewSpec={onPreview}
          onPreviewEffect={(definition, props) => {
            if (definition.kind !== "behaviour") return;
            // Layers and reacting settings run from a plan, on the stack.
            onPreviewEffect(
              typeof props.plan === "string"
                ? { module: "shader-stack", behaviour: "shaderStack", params: props }
                : {
                    module: definition.module,
                    behaviour:
                      definition.module === "custom" ? definition.id : definition.behaviour,
                    params: { ...definition.fixed, ...props },
                  },
            );
          }}
          onStopPreview={() => onPreviewEffect(null)}
          showsTimeline
          pageWeight={pageWeight}
          sceneElements={sceneElements}
          openGroups={openGroups}
          translate={motionText}
          colours={colours}
        />
      </div>
      <PointerFields
        key={`pointer-${node.id}`}
        effects={pointerEffects}
        pickImage={pickImage}
        siteCursorOn={siteCursorOn}
        motionText={motionText}
        onChange={(effects) => onChangeEffects([...listedEffects, ...effects])}
      />
    </div>
  );
}
