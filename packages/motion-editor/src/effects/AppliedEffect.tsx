import {
  cleanProps,
  isStackable,
  type EffectDefinition,
  type NodeEffect,
} from "@lintel/motion/effects";
import { Play, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../controls/Button.js";
import { useTranslate } from "../strings/translate.js";
import type { CursorColourSwatch } from "./CursorLookFields.js";
import { EffectSettings } from "./EffectSettings.js";

interface AppliedEffectProps {
  definition: EffectDefinition;
  saved: NodeEffect;
  onChange: (params: Record<string, number | string | boolean>) => void;
  onRemove: () => void;
  onTry: () => void;
  onCommit?: () => void;
  /** The site's colours, for colour settings. */
  colours?: readonly CursorColourSwatch[];
  /** Saves what its number settings react to; shader backgrounds offer this. */
  onReacts?: (reacts: NodeEffect["reacts"]) => void;
  /** Shown under the settings: "Add a layer", on shader backgrounds. */
  extra?: ReactNode;
}

/** One effect on the element: its name, what it does with less motion, and its settings. */
export function AppliedEffect({
  definition,
  saved,
  onChange,
  onRemove,
  onTry,
  onCommit,
  colours,
  onReacts,
  extra,
}: AppliedEffectProps) {
  const t = useTranslate();
  const values = cleanProps(definition, saved.params);
  return (
    <section
      aria-label={t("motionEditor.effects.settings", { name: definition.name })}
      className="flex flex-col gap-3 rounded-card bg-surface p-3 hairline-ring"
    >
      <div className="flex items-center gap-1">
        <h4 className="min-w-0 flex-1 truncate text-footnote font-semibold text-label">
          {definition.name}
        </h4>
        <Button
          variant="plain"
          icon={<Play aria-hidden="true" />}
          label={t("motionEditor.effects.preview", { name: definition.name })}
          onClick={onTry}
        />
        <Button
          variant="plain"
          icon={<Trash2 aria-hidden="true" />}
          label={t("motionEditor.effects.remove", { name: definition.name })}
          onClick={onRemove}
        />
      </div>
      <EffectSettings
        definition={definition}
        values={values}
        onChange={onChange}
        onCommit={onCommit}
        colours={colours}
        reacts={saved.reacts}
        onReacts={isStackable(definition) ? onReacts : undefined}
      />
      {extra}
      <p className="text-caption text-label-tertiary">
        {t("motionEditor.effects.lessMotion", { text: definition.reducedMotion })}
      </p>
    </section>
  );
}
