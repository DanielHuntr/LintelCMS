import { describe, expect, it } from "vitest";
import { evaluateCubicBezier } from "./cubicBezier.js";
import { easingToCss, evaluateEasing, settleDurationOf } from "./easing.js";
import { springPosition } from "./spring.js";

describe("cubic Bézier curves", () => {
  it("start at 0, end at 1 and match a straight line when the handles are on it", () => {
    const handles = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
    expect(evaluateCubicBezier(handles, 0)).toBe(0);
    expect(evaluateCubicBezier(handles, 1)).toBe(1);
    expect(evaluateCubicBezier(handles, 0.5)).toBeCloseTo(0.5, 5);
    expect(evaluateCubicBezier({ x1: 0.3, y1: 0.3, x2: 0.7, y2: 0.7 }, 0.37)).toBeCloseTo(0.37, 6);
  });

  it("matches the browser's ease-out at a known point", () => {
    // cubic-bezier(0, 0, 0.58, 1) at 25% of the time is about 37.8% of the way.
    expect(evaluateEasing("easeOut", 0.25)).toBeCloseTo(0.3781, 3);
  });

  it("overshoots for back curves", () => {
    const samples = Array.from({ length: 101 }, (_, index) =>
      evaluateEasing("easeOutBack", index / 100),
    );
    expect(Math.max(...samples)).toBeGreaterThan(1.05);
  });
});

describe("springs", () => {
  const bouncy = { type: "spring", stiffness: 260, damping: 12, mass: 1 } as const;
  const heavy = { type: "spring", stiffness: 100, damping: 40, mass: 1 } as const;

  it("settle at 1 and report how long that takes", () => {
    const duration = settleDurationOf(bouncy);
    expect(duration).toBeGreaterThan(300);
    expect(duration).toBeLessThan(3000);
    expect(springPosition(bouncy, duration / 1000)).toBeCloseTo(1, 2);
    expect(evaluateEasing(bouncy, 1)).toBe(1);
  });

  it("bounce past the end when lightly damped, and creep in when heavily damped", () => {
    const sample = (spring: typeof bouncy | typeof heavy) =>
      Array.from({ length: 200 }, (_, index) => evaluateEasing(spring, index / 200));
    expect(Math.max(...sample(bouncy))).toBeGreaterThan(1.1);
    const creeping = sample(heavy);
    expect(Math.max(...creeping)).toBeLessThanOrEqual(1);
    expect(
      creeping.every((value, index) => index === 0 || value >= (creeping[index - 1] ?? 0)),
    ).toBe(true);
  });

  it("become linear() in CSS, or the nearest curve where linear() isn't known", () => {
    expect(easingToCss(bouncy, { supportsLinearFunction: true })).toMatch(/^linear\(0, .*, 1\)$/);
    expect(easingToCss(bouncy, { supportsLinearFunction: false })).toBe(
      "cubic-bezier(0.34, 1.56, 0.64, 1)",
    );
    expect(easingToCss(heavy, { supportsLinearFunction: false })).toBe(
      "cubic-bezier(0.33, 1, 0.68, 1)",
    );
  });
});

describe("steps and CSS output", () => {
  it("jump in equal stages", () => {
    const steps = { type: "steps", count: 4, position: "end" } as const;
    expect([0, 0.24, 0.26, 0.99, 1].map((time) => evaluateEasing(steps, time))).toEqual([
      0, 0, 0.25, 0.75, 1,
    ]);
    expect(evaluateEasing({ ...steps, position: "start" }, 0.01)).toBe(0.25);
  });

  it("write every kind as a CSS timing function", () => {
    const options = { supportsLinearFunction: true };
    expect(easingToCss("linear", options)).toBe("linear");
    expect(easingToCss("easeInOut", options)).toBe("cubic-bezier(0.42, 0, 0.58, 1)");
    expect(easingToCss({ type: "cubicBezier", x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 }, options)).toBe(
      "cubic-bezier(0.1, 0.2, 0.3, 0.4)",
    );
    expect(easingToCss({ type: "steps", count: 3, position: "start" }, options)).toBe(
      "steps(3, jump-start)",
    );
  });
});
