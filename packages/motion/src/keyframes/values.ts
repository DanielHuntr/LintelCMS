/**
 * Numbers with units, such as `20`, `"20px"`, `"-50%"` or `"0.5turn"`.
 *
 * Numeric tracks are interpolated by Lintel itself when several of them share one CSS
 * property (see composeGroup.ts), so their values have to be understood, not just passed on.
 */

export interface NumericValue {
  amount: number;
  unit: string;
}

const numericPattern =
  /^\s*(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(px|%|rem|em|vw|vh|deg|turn|rad)?\s*$/i;

/** Reads a keyframe value. Returns undefined when it isn't a plain number with a unit. */
export function parseNumericValue(
  value: number | string,
  defaultUnit: string,
): NumericValue | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? { amount: value, unit: defaultUnit } : undefined;
  }
  const match = numericPattern.exec(value);
  if (!match?.[1]) return undefined;
  return { amount: Number(match[1]), unit: (match[2] ?? defaultUnit).toLowerCase() };
}

export function formatNumericValue({ amount, unit }: NumericValue): string {
  // Four decimals is far below a visible difference and keeps keyframes readable.
  const rounded = Math.round(amount * 10_000) / 10_000;
  return `${Object.is(rounded, -0) ? 0 : rounded}${unit}`;
}

/** Zero needs no unit, so `0 → -100%` moves in percent. Other units in one track must match. */
export function interpolateNumeric(
  from: NumericValue,
  to: NumericValue,
  progress: number,
): NumericValue {
  const unit = to.amount === 0 && from.amount !== 0 ? from.unit : to.unit;
  return { amount: from.amount + (to.amount - from.amount) * progress, unit };
}

/** The units a track uses, ignoring zeros. More than one means the track can't interpolate. */
export function unitsUsed(values: readonly NumericValue[]): Set<string> {
  return new Set(values.filter((value) => value.amount !== 0).map((value) => value.unit));
}
