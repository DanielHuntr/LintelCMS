import { namedEasingHandles, type Easing } from "@lintel/motion";
import { namedEasings, type NamedEasing } from "@lintel/motion/schema";
import { useState } from "react";
import { classNames } from "../controls/classNames.js";
import { SegmentedControl } from "../controls/SegmentedControl.js";
import { Slider } from "../controls/Slider.js";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";
import { BezierCurveEditor } from "./BezierCurveEditor.js";
import { curvePath } from "./curvePath.js";
import { SpringEditor } from "./SpringEditor.js";

/**
 * Choosing how a change speeds up and slows down: a named curve, a curve of your own,
 * a spring or steps. Each choice is drawn, so you see the motion before you play it.
 */

type Mode = "presets" | "curve" | "spring" | "steps";

interface EasingEditorProps {
  /** Undefined means "use the animation's easing", when `inheritLabel` is given. */
  value: Easing | undefined;
  onChange: (value: Easing | undefined, mergeKey?: string) => void;
  onCommit: () => void;
  inheritLabel?: string;
  onMatchDuration?: (milliseconds: number) => void;
}

function modeOf(value: Easing | undefined): Mode {
  if (value === undefined || typeof value === "string") return "presets";
  if (value.type === "cubicBezier") return "curve";
  return value.type;
}

function toBezier(value: Easing | undefined): Extract<Easing, { type: "cubicBezier" }> {
  if (typeof value === "string" && value !== "linear")
    return { type: "cubicBezier", ...namedEasingHandles[value] };
  if (typeof value === "object" && value.type === "cubicBezier") return value;
  return { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
}

const thumbnailBox = { size: 36, overshoot: 0.3 };

/** The friendly name of each named curve, e.g. easeOutBack is "Overshoot, then settle". */
export const easingNameKeys: Record<NamedEasing, MotionEditorStringKey> = Object.fromEntries(
  namedEasings.map((name) => [name, `motionEditor.easing.name.${name}`]),
) as Record<NamedEasing, MotionEditorStringKey>;

export function EasingEditor({
  value,
  onChange,
  onCommit,
  inheritLabel,
  onMatchDuration,
}: EasingEditorProps) {
  const t = useTranslate();
  const [mode, setMode] = useState<Mode>(modeOf(value));

  function switchMode(next: Mode) {
    setMode(next);
    if (next === "curve") onChange(toBezier(value));
    if (next === "spring" && modeOf(value) !== "spring")
      onChange({ type: "spring", stiffness: 170, damping: 26, mass: 1 });
    if (next === "steps" && modeOf(value) !== "steps")
      onChange({ type: "steps", count: 4, position: "end" });
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("motionEditor.easing.kind")}
        value={mode}
        onChange={switchMode}
        options={[
          { value: "presets", label: t("motionEditor.easing.presets") },
          { value: "curve", label: t("motionEditor.easing.curve") },
          { value: "spring", label: t("motionEditor.easing.spring") },
          { value: "steps", label: t("motionEditor.easing.steps") },
        ]}
      />
      {mode === "presets" && (
        <div
          role="group"
          aria-label={t("motionEditor.easing.presets")}
          className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-1.5"
        >
          {inheritLabel && (
            <EasingChoice
              selected={value === undefined}
              label={inheritLabel}
              onSelect={() => onChange(undefined)}
            />
          )}
          {namedEasings.map((name) => (
            <EasingChoice
              key={name}
              selected={value === name}
              label={t(easingNameKeys[name])}
              easing={name}
              onSelect={() => onChange(name)}
            />
          ))}
        </div>
      )}
      {mode === "curve" && (
        <BezierCurveEditor value={toBezier(value)} onChange={onChange} onCommit={onCommit} />
      )}
      {mode === "spring" && typeof value === "object" && value.type === "spring" && (
        <SpringEditor
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          onMatchDuration={onMatchDuration}
        />
      )}
      {mode === "steps" && typeof value === "object" && value.type === "steps" && (
        <Slider
          label={t("motionEditor.easing.stepCount")}
          min={1}
          max={24}
          step={1}
          value={value.count}
          displayValue={String(value.count)}
          onChange={(count) => onChange({ ...value, count }, "steps")}
          onCommit={onCommit}
        />
      )}
    </div>
  );
}

function EasingChoice({
  selected,
  label,
  easing,
  onSelect,
}: {
  selected: boolean;
  label: string;
  easing?: NamedEasing;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={classNames(
        "flex items-center gap-2 rounded-control p-1.5 text-left text-caption focus-visible:focus-ring",
        selected ? "bg-accent/12 text-accent" : "text-label hover:bg-fill",
      )}
    >
      <svg viewBox="-3 -3 42 42" className="size-7 shrink-0" aria-hidden="true">
        <rect width="36" height="36" rx="5" fill="var(--color-fill)" />
        {easing && (
          <path
            d={curvePath(easing, thumbnailBox, 24)}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        )}
      </svg>
      <span className="leading-tight">{label}</span>
    </button>
  );
}
