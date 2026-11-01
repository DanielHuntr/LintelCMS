import { describe, expect, it } from "vitest";
import { reduceMotion } from "../reduced-motion/reducedMotion.js";
import { motionSpecSchema } from "../spec/motion.schema.js";
import { motionPresets, presetCategories, presetsIn } from "./index.js";

describe("the preset library", () => {
  it("has more than thirty presets with unique ids", () => {
    expect(motionPresets.length).toBeGreaterThanOrEqual(30);
    expect(new Set(motionPresets.map((preset) => preset.id)).size).toBe(motionPresets.length);
  });

  it("fills every category", () => {
    for (const category of presetCategories) expect(presetsIn(category).length).toBeGreaterThan(2);
  });

  it.each(motionPresets.map((preset) => [preset.id, preset] as const))(
    "%s is valid and described plainly",
    (_id, preset) => {
      expect(motionSpecSchema.parse(preset.spec)).toEqual(preset.spec);
      expect(preset.name.length).toBeLessThanOrEqual(28);
      expect(preset.description).toMatch(/^[A-Z].*\.$/);
      expect(preset.description.length).toBeLessThanOrEqual(140);
      // Words for editors, not developers.
      expect(preset.description).not.toMatch(/keyframe|easing|transform|opacity|css|selector/i);
      expect(() => reduceMotion(preset.spec)).not.toThrow();
    },
  );

  it("covers the effects the gallery promises", () => {
    const ids = motionPresets.map((preset) => preset.id);
    for (const id of [
      "fade-up",
      "slide-in-left",
      "scale-in",
      "blur-in",
      "mask-reveal-up",
      "words-rise",
      "letters-fade",
      "parallax-slow",
      "sticky-reveal",
      "progress-bar",
      "horizontal-scroll",
      "hover-lift",
      "hover-tilt",
      "hover-magnetic",
      "hover-underline",
      "pulse",
      "shake",
      "page-fade-in",
      "page-fade-out",
    ]) {
      expect(ids).toContain(id);
    }
  });
});
