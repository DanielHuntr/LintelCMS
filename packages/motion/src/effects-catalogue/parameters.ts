import type { EffectParameter } from "./effect-definition.js";

/** Short ways to write an effect's settings. Labels are the plain words Simple mode shows. */

export function number(
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  { step, unit }: { step?: number; unit?: string } = {},
) {
  return {
    kind: "number",
    label,
    default: defaultValue,
    min,
    max,
    step,
    unit,
  } as const satisfies EffectParameter;
}

export function choice<const Value extends string>(
  label: string,
  defaultValue: NoInfer<Value>,
  choices: ReadonlyArray<readonly [Value, string]>,
) {
  return {
    kind: "choice",
    label,
    default: defaultValue as string,
    choices: choices.map(([value, choiceLabel]) => ({ value, label: choiceLabel })),
  } as const satisfies EffectParameter;
}

export function colour(label: string, defaultValue: string) {
  return { kind: "colour", label, default: defaultValue } as const satisfies EffectParameter;
}

export function toggle(label: string, defaultValue: boolean) {
  return { kind: "switch", label, default: defaultValue } as const satisfies EffectParameter;
}

export function text(label: string, defaultValue: string, maxLength = 200) {
  return {
    kind: "text",
    label,
    default: defaultValue,
    maxLength,
  } as const satisfies EffectParameter;
}

/** A setting folded under "More settings". */
export function more<Parameter extends EffectParameter>(parameter: Parameter) {
  return { ...parameter, more: true } as const;
}

/** Settings most effects share. */
export const common = {
  speed: (defaultValue = 1) => number("Speed", defaultValue, 0.2, 3, { step: 0.1, unit: "×" }),
  strength: (defaultValue = 0.35) => number("How strong", defaultValue, 0.05, 1, { step: 0.05 }),
  smoothing: (defaultValue = 0.82) =>
    number("How softly it follows", defaultValue, 0, 0.95, { step: 0.05 }),
  duration: (defaultValue = 900) =>
    number("How long it takes", defaultValue, 200, 5000, { step: 50, unit: "ms" }),
};
