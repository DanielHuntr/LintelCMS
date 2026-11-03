import { effectRegistry } from "@lintel/motion/effects";
import { findPreset, motionPresets } from "@lintel/motion/presets";
import { motionSpecSchema } from "@lintel/motion/schema";
import { describe, expect, it } from "vitest";
import { listMotionChoices, momentOfSpec, motionMoments } from "./motionChoices.js";
import {
  distanceForStartSize,
  feelOf,
  growsFrom,
  quickChoicesFor,
  quickControls,
  quickPickLimit,
  quickPicks,
  quickResult,
  quickSpec,
  settingsOf,
  startSizeFor,
  withFeel,
} from "./quickPicks.js";

describe("quick picks", () => {
  const any = listMotionChoices(motionPresets, effectRegistry, "any");

  it("finds every pick among the existing presets and animation effects", () => {
    const text = listMotionChoices(motionPresets, effectRegistry, "text");
    const container = listMotionChoices(motionPresets, effectRegistry, "container");
    for (const moment of motionMoments) {
      for (const pick of quickPicks[moment]) {
        const offered = [any, text, container].some((choices) =>
          choices.some((choice) => choice.id === pick.id && choice.moment === moment),
        );
        expect(offered, `${moment}: ${pick.id}`).toBe(true);
      }
    }
  });

  it("offers a few tiles per moment, at most six, each one an animation", () => {
    for (const moment of motionMoments) {
      const tiles = quickChoicesFor(moment, any, "any");
      expect(tiles.length, moment).toBeGreaterThanOrEqual(2);
      expect(tiles.length, moment).toBeLessThanOrEqual(quickPickLimit);
      for (const tile of tiles) expect(() => quickSpec(tile.choice, moment)).not.toThrow();
    }
  });

  it("starts each moment with a gentle default", () => {
    const first = (moment: (typeof motionMoments)[number]) =>
      quickChoicesFor(moment, any, "any")[0]?.choice.id;
    expect(first("appears")).toBe("fade-up");
    expect(first("hover")).toBe("hover-lift");
    expect(first("click")).toBe("press");
    expect(first("scroll")).toBe("parallax-slow");
    expect(first("always")).toBe("pulse-placeholder");
  });

  it("suits the element: words for text, the underline only for text and buttons", () => {
    const text = listMotionChoices(motionPresets, effectRegistry, "text");
    const image = listMotionChoices(motionPresets, effectRegistry, "image");
    const ids = (choices: typeof any, kind: "text" | "image", moment: "appears" | "hover") =>
      quickChoicesFor(moment, choices, kind).map((tile) => tile.choice.id);
    expect(ids(text, "text", "appears")).toContain("words-rise");
    expect(ids(image, "image", "appears")).not.toContain("words-rise");
    expect(ids(text, "text", "hover")).toContain("hover-underline");
    expect(ids(image, "image", "hover")).not.toContain("hover-underline");
  });

  it("picks the animation when an id is both a preset and an effect", () => {
    const parallax = quickChoicesFor("scroll", any, "any")[0];
    expect(parallax?.choice.kind).toBe("preset");
  });

  it("makes the eye-catchers under Click play when the element is clicked", () => {
    const shake = quickChoicesFor("click", any, "any").find((tile) => tile.choice.id === "shake");
    const spec = quickSpec(shake!.choice, "click");
    expect(findPreset("shake")!.spec.trigger.type).toBe("event");
    expect(spec.trigger.type).toBe("click");
    expect(momentOfSpec(spec)).toBe("click");
  });

  it("applies the plain controls to the tile's spec, which stays valid", () => {
    const base = findPreset("fade-up")!.spec;
    const settings = settingsOf(base);
    expect(quickResult(base, settings)).toEqual(base);
    const slower = quickResult(base, {
      adjustments: { ...settings.adjustments, speed: 0.5, distance: 2, delay: 400 },
      feel: "springy",
    });
    expect(slower.duration).toBe(base.duration * 2);
    expect(slower.delay).toBe(400);
    expect(feelOf(slower)).toBe("springy");
    expect(motionSpecSchema.safeParse(slower).success).toBe(true);
    // A preset that's springy already can be made smooth, and back.
    const press = findPreset("press")!.spec;
    expect(feelOf(press)).toBe("springy");
    expect(feelOf(withFeel(press, "smooth"))).toBe("smooth");
    expect(withFeel(press, "springy")).toBe(press);
  });

  it("shows only the controls that mean something for the motion", () => {
    expect(quickControls(findPreset("fade-up")!.spec, "appears")).toEqual({
      howMuch: true,
      speed: true,
      feel: true,
      starts: true,
    });
    // A fade has no distance; a scroll scene has no speed or feel; a loop has no feel.
    expect(quickControls(findPreset("fade-in")!.spec, "appears").howMuch).toBe(false);
    expect(quickControls(findPreset("parallax-slow")!.spec, "scroll")).toMatchObject({
      speed: false,
      feel: false,
      starts: false,
    });
    const always = quickChoicesFor("always", any, "any")[0]!;
    expect(quickControls(quickSpec(always.choice, "always"), "always").feel).toBe(false);
  });

  it("reads a grow while scrolling by the size it starts at, from 90% down to 10%", () => {
    const grow = findPreset("scroll-grow")!.spec;
    expect(growsFrom(grow)).toBe(0.8);
    expect(quickControls(grow, "scroll").growsFrom).toBe(0.8);
    // Only growing while scrolling: not a hover grow, not parallax.
    expect(growsFrom(findPreset("hover-grow")!.spec)).toBeUndefined();
    expect(growsFrom(findPreset("parallax-slow")!.spec)).toBeUndefined();
    expect(quickControls(findPreset("parallax-slow")!.spec, "scroll").growsFrom).toBeUndefined();

    expect(startSizeFor(0.8, 1)).toBe(0.8);
    for (const size of [0.1, 0.25, 0.5, 0.9]) {
      expect(startSizeFor(0.8, distanceForStartSize(0.8, size))).toBe(size);
    }
    // Never smaller than a tenth or bigger than 90%, however far it's pushed.
    expect(startSizeFor(0.8, 10)).toBe(0.1);
    expect(distanceForStartSize(0.8, 0)).toBeCloseTo(distanceForStartSize(0.8, 0.1));
    expect(startSizeFor(0.8, 0)).toBe(0.9);

    const settings = settingsOf(grow);
    const smallest = quickResult(grow, {
      ...settings,
      adjustments: { ...settings.adjustments, distance: distanceForStartSize(0.8, 0.1) },
    });
    const scale = smallest.tracks.find((track) => track.property === "scale");
    expect(scale?.keyframes.map((keyframe) => keyframe.value)).toEqual([0.1, 1]);
  });

  it("lists something that starts with the page and never stops under Always", () => {
    const always = quickChoicesFor("always", any, "any")[0]!;
    expect(momentOfSpec(quickSpec(always.choice, "always"))).toBe("always");
    expect(momentOfSpec(findPreset("fade-up")!.spec)).toBe("appears");
  });
});
