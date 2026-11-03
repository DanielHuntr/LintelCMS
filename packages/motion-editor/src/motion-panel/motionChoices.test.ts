import { effectRegistry } from "@lintel/motion/effects";
import { motionPresets } from "@lintel/motion/presets";
import { describe, expect, it } from "vitest";
import { listMotionChoices, motionMoments, searchMotionChoices } from "./motionChoices.js";

describe("motion choices", () => {
  const all = listMotionChoices(motionPresets, effectRegistry, "any");

  it("sorts every preset and element effect into a moment, leaving out site-wide ones", () => {
    for (const moment of motionMoments) {
      expect(
        all.some((choice) => choice.moment === moment),
        moment,
      ).toBe(true);
    }
    // Page exits, cursors and page transitions belong to the whole site.
    expect(
      all.some(
        (choice) => choice.kind === "preset" && choice.preset.spec.trigger.type === "pageExit",
      ),
    ).toBe(false);
    expect(
      all.some(
        (choice) =>
          choice.kind === "effect" &&
          ["cursor", "transitions"].includes(choice.definition.category),
      ),
    ).toBe(false);
    expect(all.length).toBeGreaterThan(140);
  });

  it("keeps each moment's groups together, in a fixed order", () => {
    const appears = all
      .filter((choice) => choice.moment === "appears")
      .map((choice) => choice.group);
    // "As the page opens" had only the whole-page presets, which are now a site setting.
    expect([...new Set(appears)]).toEqual(["blocks", "words", "drawings"]);
  });

  it("offers only the effects that suit the element", () => {
    const forText = listMotionChoices(motionPresets, effectRegistry, "text");
    expect(forText.some((choice) => choice.id === "scramble-in")).toBe(true);
    expect(forText.some((choice) => choice.id === "cylinder-gallery")).toBe(false);
  });

  it("finds choices by every word typed, across moments", () => {
    const found = searchMotionChoices(all, "fade up");
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((choice) => /fade/i.test(choice.name + choice.description))).toBe(true);
    expect(searchMotionChoices(all, "zzzz")).toEqual([]);
  });
});
