import { findPreset } from "@lintel/motion/presets";
import { describe, expect, it } from "vitest";
import { applyAdjustments, adjustmentsOf } from "../simple/adjustSpec.js";
import {
  addKeyframe,
  addTrack,
  moveKeyframe,
  removeKeyframe,
  removeTrack,
  setKeyframeEasing,
} from "./editSpec.js";

const fadeUp = findPreset("fade-up")!.spec;

describe("editing a spec on the timeline", () => {
  it("adds a keyframe holding the value at that moment", () => {
    const linear = { ...fadeUp, easing: "linear" as const };
    const { spec, keyframeIndex } = addKeyframe(linear, 1, 0.5);
    expect(keyframeIndex).toBe(1);
    expect(spec.tracks[1]?.keyframes.map((keyframe) => keyframe.value)).toEqual([32, "16px", 0]);
  });

  it("never moves a keyframe past its neighbours", () => {
    const { spec } = addKeyframe(fadeUp, 0, 0.5);
    expect(moveKeyframe(spec, 0, 1, 2).tracks[0]?.keyframes[1]?.offset).toBe(1);
    expect(moveKeyframe(spec, 0, 0, 0.7).tracks[0]?.keyframes[0]?.offset).toBe(0.5);
  });

  it("keeps at least two keyframes and one track", () => {
    expect(removeKeyframe(fadeUp, 0, 0)).toEqual(fadeUp);
    const single = removeTrack(fadeUp, 0);
    expect(single.tracks).toHaveLength(1);
    expect(removeTrack(single, 0)).toEqual(single);
  });

  it("adds tracks with a sensible starting move, once per property", () => {
    const spec = addTrack(fadeUp, "blur");
    expect(spec.tracks.at(-1)).toEqual({
      property: "blur",
      keyframes: [
        { offset: 0, value: 8 },
        { offset: 1, value: 0 },
      ],
    });
    expect(addTrack(spec, "blur")).toBe(spec);
  });

  it("sets and clears a keyframe's own easing", () => {
    const eased = setKeyframeEasing(fadeUp, 0, 0, "easeInBack");
    expect(eased.tracks[0]?.keyframes[0]?.easing).toBe("easeInBack");
    expect(setKeyframeEasing(eased, 0, 0, undefined).tracks[0]?.keyframes[0]).not.toHaveProperty(
      "easing",
    );
  });
});

describe("the simple sliders", () => {
  it("change speed, distance, delay and stagger from the preset, without drifting", () => {
    const words = findPreset("words-rise")!.spec;
    const adjusted = applyAdjustments(words, {
      ...adjustmentsOf(words),
      speed: 2,
      distance: 2,
      delay: 300,
    });
    expect(adjusted).toMatchObject({ duration: 350, delay: 300, stagger: { each: 35 } });
    expect(adjusted.tracks[1]?.keyframes[0]?.value).toBe("1.2em");
    expect(applyAdjustments(words, adjustmentsOf(words))).toEqual(words);
  });

  it("scale sizes around 1 and leave fades alone", () => {
    const scaleIn = findPreset("scale-in")!.spec;
    const subtle = applyAdjustments(scaleIn, { ...adjustmentsOf(scaleIn), distance: 0.5 });
    expect(subtle.tracks.find((track) => track.property === "scale")?.keyframes[0]?.value).toBe(
      0.96,
    );
    expect(subtle.tracks.find((track) => track.property === "opacity")).toEqual(scaleIn.tracks[0]);
  });
});
