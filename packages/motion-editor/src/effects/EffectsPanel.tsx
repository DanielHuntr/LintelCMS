import {
  defaultProps,
  effectRegistry,
  maxEffectsPerElement,
  type AnimationEffect,
  type EffectDefinition,
  type EffectRegistry,
  type ElementKind,
  type NodeEffect,
  type PageWeight,
} from "@lintel/motion/effects";
import { useMemo } from "react";
import { TranslateProvider, useTranslate, type Translate } from "../strings/translate.js";
import { AppliedEffect } from "./AppliedEffect.js";
import { EffectsGallery } from "./EffectsGallery.js";
import { PageWeightMeter } from "./PageWeightMeter.js";

export interface EffectsPanelProps {
  /** The element's effects, as saved. */
  effects: readonly NodeEffect[];
  elementKind: ElementKind;
  onChange: (effects: NodeEffect[]) => void;
  /** "Animation" effects become the element's animation: the host saves it there. */
  onApplyAnimation: (
    definition: AnimationEffect,
    props: Record<string, number | string | boolean>,
  ) => void;
  /** Runs an effect on the element on the page (null stops it). */
  onPreview?: (
    definition: EffectDefinition,
    props: Record<string, number | string | boolean>,
  ) => void;
  onStopPreview?: () => void;
  /** Lets undo treat a drag on a slider as one change. */
  onCommit?: () => void;
  /** The page's effects added up, for the meter. */
  pageWeight?: PageWeight;
  registry?: EffectRegistry;
  /** Where each effect module is served, so cards can run the real thing. */
  moduleAddresses?: Readonly<Record<string, string>>;
  translate?: Translate;
}

/**
 * The Animate tab's Effects: what the element has, each with its settings in plain words,
 * the gallery to add more, and what the page's effects weigh.
 */
export function EffectsPanel(props: EffectsPanelProps) {
  return (
    <TranslateProvider translate={props.translate}>
      <Effects {...props} />
    </TranslateProvider>
  );
}

function Effects({
  effects,
  elementKind,
  onChange,
  onApplyAnimation,
  onPreview,
  onStopPreview,
  onCommit,
  pageWeight,
  registry = effectRegistry,
  moduleAddresses,
}: EffectsPanelProps) {
  const t = useTranslate();
  const known = effects.flatMap((saved, index) => {
    const definition = registry.find(saved.effect);
    return definition ? [{ saved, definition, index }] : [];
  });
  const addedIds = useMemo(() => new Set(effects.map((saved) => saved.effect)), [effects]);
  const full = effects.length >= maxEffectsPerElement;

  function apply(definition: EffectDefinition) {
    const props = defaultProps(definition.params);
    if (definition.kind === "animation") {
      onApplyAnimation(definition, props);
      return;
    }
    if (full || addedIds.has(definition.id)) return;
    onChange([...effects, { effect: definition.id, params: props }]);
    onCommit?.();
  }

  return (
    <div className="flex flex-col gap-4">
      {pageWeight && <PageWeightMeter weight={pageWeight} />}
      <section aria-labelledby="effects-applied" className="flex flex-col gap-2">
        <h3 id="effects-applied" className="text-footnote font-semibold text-label">
          {t("motionEditor.effects.applied")}
        </h3>
        {known.length === 0 ? (
          <p className="text-caption text-label-secondary">{t("motionEditor.effects.none")}</p>
        ) : (
          known.map(({ saved, definition, index }) => (
            <AppliedEffect
              key={`${saved.effect}-${index}`}
              definition={definition}
              saved={saved}
              onChange={(params) =>
                onChange(effects.map((item, at) => (at === index ? { ...item, params } : item)))
              }
              onRemove={() => {
                onStopPreview?.();
                onChange(effects.filter((_, at) => at !== index));
                onCommit?.();
              }}
              onTry={() => onPreview?.(definition, saved.params)}
              onCommit={onCommit}
            />
          ))
        )}
        {full && (
          <p className="text-caption text-warning">
            {t("motionEditor.effects.limit", { count: maxEffectsPerElement })}
          </p>
        )}
      </section>
      <EffectsGallery
        elementKind={elementKind}
        addedIds={addedIds}
        registry={registry}
        moduleAddresses={moduleAddresses}
        onApply={apply}
        onTry={(definition) =>
          definition ? onPreview?.(definition, defaultProps(definition.params)) : onStopPreview?.()
        }
      />
      <p className="text-caption text-label-tertiary">
        {t("motionEditor.effects.becomesAnimation")}
      </p>
    </div>
  );
}
