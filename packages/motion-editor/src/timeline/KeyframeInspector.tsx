import { describeProperty, type MotionSpec } from "@lintel/motion";
import { Trash2 } from "lucide-react";
import { Button } from "../controls/Button.js";
import { TextInput } from "../controls/Field.js";
import { EasingEditor } from "../easing-editor/EasingEditor.js";
import { useTranslate } from "../strings/translate.js";
import {
  moveKeyframe,
  removeKeyframe,
  setDuration,
  setKeyframeEasing,
  setKeyframeValue,
} from "./editSpec.js";
import { usePropertyLabel } from "./propertyLabels.js";
import type { KeyframeSelection } from "./TrackRow.js";

interface KeyframeInspectorProps {
  spec: MotionSpec;
  selection: KeyframeSelection;
  onSelect: (selection: KeyframeSelection | undefined) => void;
  onChange: (spec: MotionSpec, mergeKey?: string) => void;
  onCommit: () => void;
}

const numericValue = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;

/** The selected keyframe: when it happens, its value, and how it eases into the next one. */
export function KeyframeInspector({
  spec,
  selection,
  onSelect,
  onChange,
  onCommit,
}: KeyframeInspectorProps) {
  const t = useTranslate();
  const { trackIndex, keyframeIndex } = selection;
  const track = spec.tracks[trackIndex];
  const keyframe = track?.keyframes[keyframeIndex];
  const name = usePropertyLabel(track?.property ?? "opacity");
  if (!track || !keyframe) return null;
  const definition = describeProperty(track.property);
  const isNumeric =
    definition.kind === "number" || definition.kind === "length" || definition.kind === "angle";
  const isLast = keyframeIndex === track.keyframes.length - 1;
  const mergeKey = `keyframe-${trackIndex}-${keyframeIndex}`;

  function changeValue(text: string) {
    const match = numericValue.exec(text.trim());
    // Numbers in the property's usual unit are stored as numbers, so specs stay tidy.
    const value =
      isNumeric && match && (match[2] === "" || match[2] === definition.unit)
        ? Number(match[1])
        : text;
    if (text.trim() === "") return;
    onChange(setKeyframeValue(spec, trackIndex, keyframeIndex, value), mergeKey);
  }

  return (
    <section aria-labelledby="keyframe-inspector-title" className="@container flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id="keyframe-inspector-title" className="text-headline text-label">
          {t("motionEditor.inspector.title", { property: name, number: keyframeIndex + 1 })}
        </h3>
        <Button
          variant="plain"
          icon={<Trash2 aria-hidden="true" />}
          disabled={track.keyframes.length <= 2}
          onClick={() => {
            onSelect(undefined);
            onChange(removeKeyframe(spec, trackIndex, keyframeIndex));
          }}
        >
          {t("motionEditor.inspector.remove")}
        </Button>
      </div>
      <div className="grid gap-3 @xs:grid-cols-2">
        <TextInput
          label={t("motionEditor.inspector.time")}
          type="number"
          min={0}
          max={spec.duration}
          step={10}
          value={Math.round(keyframe.offset * spec.duration)}
          onChange={(event) => {
            const milliseconds = Number(event.target.value);
            if (!Number.isFinite(milliseconds)) return;
            // Typing a time past the end makes the animation longer, rather than refusing.
            const longer = milliseconds > spec.duration ? setDuration(spec, milliseconds) : spec;
            onChange(
              moveKeyframe(
                longer,
                trackIndex,
                keyframeIndex,
                longer.duration > 0 ? milliseconds / longer.duration : 0,
              ),
              mergeKey,
            );
          }}
          onBlur={onCommit}
        />
        <TextInput
          key={`${trackIndex}-${keyframeIndex}`}
          label={
            definition.unit
              ? t("motionEditor.inspector.valueWithUnit", { unit: definition.unit })
              : t("motionEditor.inspector.value")
          }
          hint={isNumeric ? undefined : t("motionEditor.inspector.textHint")}
          defaultValue={String(keyframe.value)}
          onChange={(event) => changeValue(event.target.value)}
          onBlur={onCommit}
        />
      </div>
      {!isLast && (
        <div className="flex flex-col gap-2">
          <h4 className="text-footnote font-semibold text-label">
            {t("motionEditor.inspector.easing")}
          </h4>
          <EasingEditor
            key={`${trackIndex}-${keyframeIndex}`}
            value={keyframe.easing}
            inheritLabel={t("motionEditor.inspector.useAnimationEasing")}
            onChange={(easing, key) =>
              onChange(setKeyframeEasing(spec, trackIndex, keyframeIndex, easing), key ?? mergeKey)
            }
            onCommit={onCommit}
          />
        </div>
      )}
    </section>
  );
}
