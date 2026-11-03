import { describe, expect, it } from "vitest";
import { easeTowards, nearestSnapPoint, stepProgress } from "./scrollTrigger.js";

describe("scroll scene smoothing and snapping", () => {
  it("follows exactly with no smoothing, and eases behind with some", () => {
    expect(easeTowards(0, 1, 16, 0)).toBe(1);
    const afterOneFrame = easeTowards(0, 1, 16, 0.5);
    expect(afterOneFrame).toBeGreaterThan(0);
    expect(afterOneFrame).toBeLessThan(0.3);
    // The same time in fewer, longer frames lands in the same place.
    let small = 0;
    for (let frame = 0; frame < 10; frame += 1) small = easeTowards(small, 1, 10, 0.5);
    expect(easeTowards(0, 1, 100, 0.5)).toBeCloseTo(small, 6);
  });

  it("arrives rather than creeping for ever", () => {
    let shown = 0;
    for (let frame = 0; frame < 200; frame += 1) shown = easeTowards(shown, 1, 16, 0.5);
    expect(shown).toBe(1);
  });

  it("settles on the nearest snap point", () => {
    expect(nearestSnapPoint([0, 0.5, 1], 0.2)).toBe(0);
    expect(nearestSnapPoint([0, 0.5, 1], 0.4)).toBe(0.5);
    expect(nearestSnapPoint([0, 0.5, 1], 0.8)).toBe(1);
  });

  it("maps the whole scene onto one step's part of it", () => {
    expect(stepProgress(0.3, undefined)).toBe(0.3);
    expect(stepProgress(0.3, { from: 0.5, to: 1 })).toBe(0);
    expect(stepProgress(0.75, { from: 0.5, to: 1 })).toBe(0.5);
    expect(stepProgress(1, { from: 0.5, to: 1 })).toBe(1);
  });
});
