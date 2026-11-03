import { defaultProps, type EffectDefinition } from "@lintel/motion/effects";
import { Check, Plus } from "lucide-react";
import { useMemo } from "react";
import { classNames } from "../controls/classNames.js";
import { PreviewSample } from "../preview/PreviewSample.js";
import { useTranslate } from "../strings/translate.js";
import { useEffectPreview } from "./useEffectPreview.js";

interface EffectCardProps {
  definition: EffectDefinition;
  added: boolean;
  moduleAddresses?: Readonly<Record<string, string>>;
  onApply: (definition: EffectDefinition) => void;
  /** Called with the effect while it is being tried (hover or focus), and null after. */
  onTry?: (definition: EffectDefinition | null) => void;
}

/**
 * One effect in the gallery. While the pointer is over it, or it has keyboard focus, it runs
 * on the card's stand-in and on the selected element on the page, so people see it on their
 * own design before adding it.
 */
export function EffectCard({
  definition,
  added,
  moduleAddresses,
  onApply,
  onTry,
}: EffectCardProps) {
  const t = useTranslate();
  const props = useMemo(() => defaultProps(definition.params), [definition]);
  const preview = useEffectPreview(definition, props, moduleAddresses);
  const descriptionId = `effect-${definition.id}-description`;
  const begin = () => {
    preview.start();
    onTry?.(definition);
  };
  const end = () => {
    preview.stop();
    onTry?.(null);
  };
  return (
    <div
      className={classNames(
        "group relative flex flex-col overflow-hidden rounded-card bg-surface hairline-ring",
        added && "ring-2 ring-accent-fill",
      )}
      onPointerEnter={begin}
      onPointerLeave={end}
      onFocus={begin}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && end()}
    >
      <div
        aria-hidden="true"
        className="flex h-28 items-center justify-center overflow-hidden bg-fill/60"
      >
        <PreviewSample sample={definition.preview} rootRef={preview.rootRef} />
      </div>
      <button
        type="button"
        aria-describedby={descriptionId}
        aria-label={t("motionEditor.effects.apply", { name: definition.name })}
        onClick={() => onApply(definition)}
        className="flex flex-col gap-0.5 p-3 text-start focus-visible:focus-ring"
      >
        <span className="flex items-center gap-1.5 text-footnote font-semibold text-label">
          {definition.name}
          {added ? (
            <Check aria-hidden="true" className="size-3.5 text-accent" />
          ) : (
            <Plus
              aria-hidden="true"
              className="ms-auto size-3.5 text-label-tertiary group-hover:text-accent"
            />
          )}
        </span>
        <span id={descriptionId} className="text-caption text-label-secondary">
          {definition.description}
        </span>
      </button>
    </div>
  );
}
