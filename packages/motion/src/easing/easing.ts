import type { Easing, NamedEasing, SpringEasing } from "../spec/easing.schema.js";
import { evaluateCubicBezier, type BezierHandles } from "./cubicBezier.js";
import { evaluateSpring, springSettleDuration } from "./spring.js";

/**
 * Turning an easing from a spec into a CSS timing function, or into a number for a moment
 * in time. Both come from the same definitions, so what the editor draws is what plays.
 */

/** The handles behind each named curve (the standard set from easings.net). */
export const namedEasingHandles: Record<Exclude<NamedEasing, "linear">, BezierHandles> = {
  ease: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  easeIn: { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  easeOut: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  easeInOut: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  easeInSine: { x1: 0.12, y1: 0, x2: 0.39, y2: 0 },
  easeOutSine: { x1: 0.61, y1: 1, x2: 0.88, y2: 1 },
  easeInOutSine: { x1: 0.37, y1: 0, x2: 0.63, y2: 1 },
  easeInCubic: { x1: 0.32, y1: 0, x2: 0.67, y2: 0 },
  easeOutCubic: { x1: 0.33, y1: 1, x2: 0.68, y2: 1 },
  easeInOutCubic: { x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
  easeInQuint: { x1: 0.64, y1: 0, x2: 0.78, y2: 0 },
  easeOutQuint: { x1: 0.22, y1: 1, x2: 0.36, y2: 1 },
  easeInOutQuint: { x1: 0.83, y1: 0, x2: 0.17, y2: 1 },
  easeInExpo: { x1: 0.7, y1: 0, x2: 0.84, y2: 0 },
  easeOutExpo: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
  easeInOutExpo: { x1: 0.87, y1: 0, x2: 0.13, y2: 1 },
  easeInBack: { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 },
  easeOutBack: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  easeInOutBack: { x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6 },
};

/** Settling times are found by simulation, so remember them per spring. */
const settleDurations = new Map<string, number>();

export function settleDurationOf(spring: SpringEasing): number {
  const key = `${spring.stiffness}/${spring.damping}/${spring.mass}`;
  let duration = settleDurations.get(key);
  if (duration === undefined) {
    duration = springSettleDuration(spring);
    settleDurations.set(key, duration);
  }
  return duration;
}

/** Progress (usually 0 to 1, more for overshoot) at `time` through a segment (0 to 1). */
export function evaluateEasing(easing: Easing, time: number): number {
  const clamped = Math.min(Math.max(time, 0), 1);
  if (easing === "linear") return clamped;
  if (typeof easing === "string") return evaluateCubicBezier(namedEasingHandles[easing], clamped);
  switch (easing.type) {
    case "cubicBezier":
      return evaluateCubicBezier(easing, clamped);
    case "spring":
      return evaluateSpring(easing, clamped, settleDurationOf(easing));
    case "steps": {
      if (clamped >= 1) return 1;
      const jumps =
        easing.position === "start"
          ? Math.floor(clamped * easing.count) + 1
          : Math.floor(clamped * easing.count);
      return Math.min(jumps / easing.count, 1);
    }
  }
}

export interface EasingCssOptions {
  /** Whether the browser understands CSS linear(), which springs need to play exactly. */
  supportsLinearFunction: boolean;
}

const springSamples = 48;

function formatHandles({ x1, y1, x2, y2 }: BezierHandles): string {
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

/** A spring as CSS: sampled into linear(), or the closest curve where linear() isn't known. */
function springToCss(spring: SpringEasing, options: EasingCssOptions): string {
  const points = Array.from({ length: springSamples + 1 }, (_, index) =>
    evaluateEasing(spring, index / springSamples),
  );
  if (!options.supportsLinearFunction) {
    const overshoots = points.some((point) => point > 1.01);
    return formatHandles(
      overshoots ? namedEasingHandles.easeOutBack : namedEasingHandles.easeOutCubic,
    );
  }
  return `linear(${points.map((point) => Math.round(point * 10_000) / 10_000).join(", ")})`;
}

export function easingToCss(easing: Easing, options: EasingCssOptions): string {
  if (easing === "linear") return "linear";
  if (typeof easing === "string") return formatHandles(namedEasingHandles[easing]);
  switch (easing.type) {
    case "cubicBezier":
      return formatHandles(easing);
    case "spring":
      return springToCss(easing, options);
    case "steps":
      return `steps(${easing.count}, jump-${easing.position})`;
  }
}
