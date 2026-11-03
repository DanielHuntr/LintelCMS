import { describe, expect, it } from "vitest";
import {
  arcBend,
  arcPerspective,
  arcPlacement,
  cardForProgress,
  depthLayerTransform,
  layerDepths,
  stackTransform,
  wrapAround,
} from "./layouts-3d.js";

describe("the arc carousel's curve", () => {
  const settings = { bend: 14, pitch: 240 };

  it("keeps the middle picture flat and facing the viewer", () => {
    for (const shape of ["away", "around"] as const) {
      const place = arcPlacement(0, { ...settings, shape });
      expect([place.x, place.z, place.turn].map(Math.abs)).toEqual([0, 0, 0]);
      expect(place.opacity).toBe(1);
    }
  });

  it("sends the ends back when it bends away, and brings them forward when it wraps round", () => {
    const away = arcPlacement(2, { ...settings, shape: "away" });
    const around = arcPlacement(2, { ...settings, shape: "around" });
    expect(away.z).toBeLessThan(0);
    expect(around.z).toBeGreaterThan(0);
    expect(away.x).toBeGreaterThan(0);
    expect(Math.sign(away.turn)).toBe(-Math.sign(around.turn));
    // Mirror images either side.
    expect(arcPlacement(-2, { ...settings, shape: "away" }).x).toBeCloseTo(-away.x);
  });

  it("hides pictures round the back of the curve", () => {
    expect(arcPlacement(12, { ...settings, shape: "away" }).opacity).toBe(0);
    expect(arcPlacement(1, { ...settings, shape: "away" }).opacity).toBe(1);
  });

  it("spaces few pictures widely enough that the one wrapping round does so out of sight", () => {
    const bend = arcBend(14, 4, "away");
    expect(bend).toBeGreaterThan(14);
    expect(arcPlacement(2, { bend, pitch: 240, shape: "away" }).opacity).toBe(0);
    expect(arcBend(14, 30, "away")).toBe(14);
  });

  it("puts the viewer behind the middle of a curve that wraps round", () => {
    const radius = 240 / ((14 * Math.PI) / 180);
    expect(arcPerspective(14, 240, "around")).toBeCloseTo(radius * 1.4);
    expect(arcPerspective(30, 100, "away")).toBe(900);
  });

  it("wraps an endless row's positions into the middle", () => {
    expect(wrapAround(7, 8)).toBe(-1);
    expect(wrapAround(-5, 8)).toBe(3);
    expect(wrapAround(2.5, 8)).toBe(2.5);
    expect(wrapAround(3, 0)).toBe(0);
  });
});

describe("card stack looks", () => {
  it("draws the top card in place whatever the look", () => {
    for (const look of ["pile", "fan", "tilted"] as const) {
      const numbers = stackTransform(0, { look, spread: 14, reduced: false })
        .replace("translate3d", "")
        .match(/-?\d+(\.\d+)?/g)
        ?.map(Number);
      expect(numbers?.every((value) => value === 0)).toBe(true);
    }
  });

  it("fans cards out to alternate sides, turned", () => {
    expect(stackTransform(1, { look: "fan", spread: 10, reduced: false })).toContain(
      "rotate(6deg)",
    );
    expect(stackTransform(2, { look: "fan", spread: 10, reduced: false })).toContain(
      "rotate(-6deg)",
    );
  });

  it("lays cards back in 3D when tilted, and flat with less motion", () => {
    expect(stackTransform(2, { look: "tilted", spread: 10, reduced: false })).toContain("rotateX");
    expect(stackTransform(2, { look: "fan", spread: 10, reduced: true })).toContain("rotate(0deg)");
  });

  it("steps through every card as the stack passes through the screen", () => {
    expect(cardForProgress(0, 4)).toBe(0);
    expect(cardForProgress(0.3, 4)).toBe(0);
    expect(cardForProgress(0.5, 4)).toBe(2);
    expect(cardForProgress(0.66, 4)).toBe(3);
    expect(cardForProgress(1, 4)).toBe(3);
    expect(cardForProgress(0.5, 1)).toBe(0);
  });
});

describe("depth on scroll", () => {
  it("spreads layers from nearest to furthest in the order asked for", () => {
    expect(layerDepths(3, "front-first")).toEqual([1, 0, -1]);
    expect(layerDepths(3, "back-first")).toEqual([-1, -0, 1]);
    expect(layerDepths(1, "mixed")).toEqual([0]);
    expect(layerDepths(0, "mixed")).toEqual([]);
    const mixed = layerDepths(5, "mixed");
    expect(mixed.every((depth) => depth >= -1 && depth <= 1)).toBe(true);
    expect(new Set(mixed).size).toBe(5);
  });

  it("rests every layer at its place mid-screen, nearer ones moving further", () => {
    const options = { look: "deep" as const, strength: 1, screenHeight: 800 };
    expect(depthLayerTransform(1, 0.5, options)).toBe("translate3d(0, 0.0px, 0.0px)");
    expect(depthLayerTransform(-1, 0.5, options)).toBe("translate3d(0, 0.0px, -120.0px)");
    const near = depthLayerTransform(1, 0.2, options);
    const far = depthLayerTransform(0.2, 0.2, options);
    const travel = (transform: string) => Number(/, (-?[\d.]+)px,/.exec(transform)?.[1]);
    expect(travel(near)).toBeGreaterThan(travel(far));
    expect(depthLayerTransform(1, 0.2, { ...options, look: "floating" })).toContain("rotateX");
  });
});
