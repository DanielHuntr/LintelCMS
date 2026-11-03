import { spring } from "motion";
import { describe, expect, it } from "vitest";
import {
  flattenPath,
  matchOutlines,
  mixOutlines,
  outlineToPath,
  resampleOutline,
} from "./pathMorph.js";
import { approach, springIsAtRest, stepSpring, type SpringState } from "./smoothing.js";
import { VelocityTracker, velocityStrength } from "./velocity.js";

describe("following a moving value", () => {
  it("covers the same ground at any frame rate", () => {
    let at60 = 0;
    for (let frame = 0; frame < 60; frame += 1) at60 = approach(at60, 100, 0.8, 1000 / 60);
    let at30 = 0;
    for (let frame = 0; frame < 30; frame += 1) at30 = approach(at30, 100, 0.8, 1000 / 30);
    expect(at30).toBeCloseTo(at60, 1);
  });

  it("jumps straight there with no smoothing and lands exactly when close", () => {
    expect(approach(0, 50, 0, 16)).toBe(50);
    expect(approach(49.9995, 50, 0.9, 16)).toBe(50);
  });
});

describe("the hand-stepped spring", () => {
  it("overshoots when lightly damped, then comes to rest on the target", () => {
    let state: SpringState = { value: 0, velocity: 0 };
    let highest = 0;
    for (let frame = 0; frame < 240; frame += 1) {
      state = stepSpring(state, 1, { stiffness: 200, damping: 8 }, 16);
      highest = Math.max(highest, state.value);
    }
    expect(highest).toBeGreaterThan(1.2);
    expect(springIsAtRest(state, 1)).toBe(true);
  });

  it("never overshoots when critically damped", () => {
    let state: SpringState = { value: 0, velocity: 0 };
    const stiffness = 100;
    for (let frame = 0; frame < 120; frame += 1) {
      state = stepSpring(state, 1, { stiffness, damping: 2 * Math.sqrt(stiffness) }, 16);
      expect(state.value).toBeLessThanOrEqual(1.0001);
    }
  });

  it("stays stable when a frame arrives very late", () => {
    const state = stepSpring({ value: 0, velocity: 0 }, 1, { stiffness: 400, damping: 20 }, 500);
    expect(Number.isFinite(state.value)).toBe(true);
    expect(Math.abs(state.value - 1)).toBeLessThan(0.5);
  });

  it("agrees with the motion library's spring on where it settles", () => {
    const generator = spring({ keyframes: [0, 100], stiffness: 170, damping: 26 });
    let ours: SpringState = { value: 0, velocity: 0 };
    for (let time = 0; time < 2000; time += 16)
      ours = stepSpring(ours, 100, { stiffness: 170, damping: 26 }, 16);
    expect(generator.next(2000).value).toBeCloseTo(ours.value, 0);
  });
});

describe("velocity", () => {
  it("measures units per second over recent samples", () => {
    const tracker = new VelocityTracker(100);
    tracker.add(0, 0);
    tracker.add(50, 50);
    tracker.add(100, 100);
    expect(tracker.velocity(100)).toBeCloseTo(1000);
  });

  it("reads as still once the samples are stale, and forgets old ones", () => {
    const tracker = new VelocityTracker(100);
    tracker.add(0, 0);
    tracker.add(100, 50);
    expect(tracker.velocity(400)).toBe(0);
    for (let time = 1000; time <= 1300; time += 50) tracker.add(10, time);
    expect(tracker.velocity(1300)).toBe(0);
  });

  it("turns a speed into a strength between -1 and 1", () => {
    expect(velocityStrength(1500, 3000)).toBe(0.5);
    expect(velocityStrength(-9000, 3000)).toBe(-1);
    expect(velocityStrength(100, 0)).toBe(0);
  });
});

describe("shape morphing", () => {
  const square = "M0 0 H100 V100 H0 Z";
  const triangle = "M50 0 L100 100 L0 100 Z";

  it("flattens lines and curves into points", () => {
    expect(flattenPath(square)).toEqual([
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ]);
    const curve = flattenPath("M0 0 C 0 50 100 50 100 0", 10);
    expect(curve).toHaveLength(11);
    expect(curve[5]?.[1]).toBeCloseTo(37.5);
    expect(flattenPath("m10 10 l10 0 l0 10")).toEqual([
      [10, 10],
      [20, 10],
      [20, 20],
    ]);
  });

  it("spaces points evenly round the outline", () => {
    const points = resampleOutline(flattenPath(square), 8);
    expect(points).toHaveLength(8);
    expect(points[2]).toEqual([100, 0]);
    expect(points[3]).toEqual([100, 50]);
  });

  it("gives two different shapes matching points that run the same way round", () => {
    const clockwise = flattenPath(square);
    const anticlockwise = [...clockwise].reverse();
    const [from, to] = matchOutlines(clockwise, anticlockwise, 16);
    expect(from).toHaveLength(16);
    expect(to).toHaveLength(16);
    // The same shape, matched to itself, needs no travel at all.
    const travel = from.reduce(
      (total, [x, y], index) => total + Math.hypot(x - to[index]![0], y - to[index]![1]),
      0,
    );
    expect(travel).toBeCloseTo(0, 5);
  });

  it("starts at the first shape, ends at the second, and writes valid path data", () => {
    const [from, to] = matchOutlines(flattenPath(square), flattenPath(triangle), 24);
    expect(mixOutlines(from, to, 0)).toEqual(from);
    expect(mixOutlines(from, to, 1)).toEqual(to);
    expect(outlineToPath(mixOutlines(from, to, 0.5))).toMatch(/^M[\d.\s-]+(L[\d.\s-]+){23}Z$/);
  });
});
