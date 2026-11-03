import type { EffectDefinition, EffectParameter } from "@lintel/motion/effects";
import { useId } from "react";
import { Checkbox, Select, TextInput } from "../controls/Field.js";
import { Slider } from "../controls/Slider.js";

/**
 * An effect's settings in plain words, for Simple mode: a slider for each number, a menu for
 * each choice, a colour well, a switch or a text box. Every control has a visible label.
 */
interface EffectSettingsProps {
  definition: EffectDefinition;
  values: Readonly<Record<string, number | string | boolean>>;
  onChange: (values: Record<string, number | string | boolean>) => void;
  onCommit?: () => void;
}

function formatNumber(parameter: Extract<EffectParameter, { kind: "number" }>, value: number) {
  const rounded = Math.round(value * 100) / 100;
  return parameter.unit
    ? `${rounded}${parameter.unit === "×" ? "×" : ` ${parameter.unit}`}`
    : String(rounded);
}

function ColourInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-caption font-medium text-label-secondary">
        {label}
      </label>
      <input
        id={id}
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#7539fd"}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-12 cursor-pointer rounded-control bg-fill p-0.5 focus-visible:focus-ring"
      />
    </div>
  );
}

export function EffectSettings({ definition, values, onChange, onCommit }: EffectSettingsProps) {
  const entries = Object.entries(definition.params);
  if (entries.length === 0) return null;
  const set = (name: string, value: number | string | boolean) =>
    onChange({ ...values, [name]: value });
  return (
    <div className="flex flex-col gap-3">
      {entries.map(([name, parameter]) => {
        const value = values[name] ?? parameter.default;
        switch (parameter.kind) {
          case "number":
            return (
              <Slider
                key={name}
                label={parameter.label}
                value={Number(value)}
                min={parameter.min}
                max={parameter.max}
                step={parameter.step ?? (parameter.max - parameter.min > 20 ? 1 : 0.01)}
                displayValue={formatNumber(parameter, Number(value))}
                valueText={formatNumber(parameter, Number(value))}
                onChange={(next) => set(name, next)}
                onCommit={onCommit}
              />
            );
          case "choice":
            return (
              <Select
                key={name}
                label={parameter.label}
                options={parameter.choices}
                value={String(value)}
                onChange={(event) => (set(name, event.target.value), onCommit?.())}
              />
            );
          case "colour":
            return (
              <ColourInput
                key={name}
                label={parameter.label}
                value={String(value)}
                onChange={(next) => set(name, next)}
              />
            );
          case "switch":
            return (
              <Checkbox
                key={name}
                label={parameter.label}
                checked={Boolean(value)}
                onChange={(next) => (set(name, next), onCommit?.())}
              />
            );
          case "text":
            return (
              <TextInput
                key={name}
                label={parameter.label}
                value={String(value)}
                maxLength={parameter.maxLength}
                onChange={(event) => set(name, event.target.value)}
                onBlur={onCommit}
              />
            );
        }
        return null;
      })}
    </div>
  );
}
