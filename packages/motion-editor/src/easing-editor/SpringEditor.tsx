import { settleDurationOf, type Easing } from "@lintel/motion";
import { Button } from "../controls/Button.js";
import { Slider } from "../controls/Slider.js";
import { useTranslate } from "../strings/translate.js";
import { curvePath, type CurveBox } from "./curvePath.js";

type Spring = Extract<Easing, { type: "spring" }>;

interface SpringEditorProps {
  value: Spring;
  onChange: (value: Spring, mergeKey?: string) => void;
  onCommit: () => void;
  /** Sets the animation's length to the spring's natural settling time. */
  onMatchDuration?: (milliseconds: number) => void;
}

const box: CurveBox = { size: 160, overshoot: 0.3 };

/** A spring: how stiff it is, how quickly the bounce dies, and how heavy it feels. */
export function SpringEditor({ value, onChange, onCommit, onMatchDuration }: SpringEditorProps) {
  const t = useTranslate();
  const settles = settleDurationOf(value);
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex flex-col items-center gap-2">
        <svg
          viewBox={`-6 -6 ${box.size + 12} ${box.size + 12}`}
          className="w-40 overflow-visible"
          aria-hidden="true"
        >
          <rect x="0" y="0" width={box.size} height={box.size} rx="6" fill="var(--color-fill)" />
          <path
            d={curvePath(value, box, 96)}
            fill="none"
            stroke="var(--color-accent-fill)"
            strokeWidth="2.5"
          />
        </svg>
        <p className="text-caption text-label-secondary" aria-live="polite">
          {t("motionEditor.easing.settlesIn", { milliseconds: settles })}
        </p>
        {onMatchDuration && (
          <Button onClick={() => onMatchDuration(settles)}>
            {t("motionEditor.easing.matchDuration")}
          </Button>
        )}
      </div>
      <div className="flex min-w-44 flex-1 flex-col gap-4">
        <Slider
          label={t("motionEditor.easing.stiffness")}
          minLabel={t("motionEditor.easing.stiffnessLow")}
          maxLabel={t("motionEditor.easing.stiffnessHigh")}
          min={20}
          max={600}
          step={10}
          value={value.stiffness}
          displayValue={String(value.stiffness)}
          onChange={(stiffness) => onChange({ ...value, stiffness }, "spring-stiffness")}
          onCommit={onCommit}
        />
        <Slider
          label={t("motionEditor.easing.damping")}
          minLabel={t("motionEditor.easing.dampingLow")}
          maxLabel={t("motionEditor.easing.dampingHigh")}
          min={2}
          max={60}
          step={1}
          value={value.damping}
          displayValue={String(value.damping)}
          onChange={(damping) => onChange({ ...value, damping }, "spring-damping")}
          onCommit={onCommit}
        />
        <Slider
          label={t("motionEditor.easing.mass")}
          minLabel={t("motionEditor.easing.massLow")}
          maxLabel={t("motionEditor.easing.massHigh")}
          min={0.2}
          max={5}
          step={0.1}
          value={value.mass}
          displayValue={String(value.mass)}
          onChange={(mass) => onChange({ ...value, mass }, "spring-mass")}
          onCommit={onCommit}
        />
      </div>
    </div>
  );
}
