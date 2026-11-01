import { describe, expect, it } from "vitest";
import { findPreset } from "../presets/index.js";
import { defineMotion } from "../spec/motion.schema.js";
import { reduceMotion } from "./reducedMotion.js";

const slideIn = defineMotion({
  trigger: { type: "inView" },
  targets: { type: "text", split: "words" },
  stagger: { each: 120 },
  duration: 900,
  repeat: { times: 2 },
  tracks: [
    {
      property: "translateX",
      keyframes: [
        { offset: 0, value: -40 },
        { offset: 1, value: 0 },
      ],
    },
    {
      property: "color",
      keyframes: [
        { offset: 0, value: "#888" },
        { offset: 1, value: "#000" },
      ],
    },
  ],
});

describe("reduced motion", () => {
  it("leaves the element alone for 'none'", () => {
    expect(reduceMotion({ ...slideIn, reducedMotion: "none" })).toBeUndefined();
  });

  it("keeps only fades and colours for 'fade', short and once", () => {
    const reduced = reduceMotion(slideIn);
    expect(reduced?.tracks.map((track) => track.property)).toEqual(["color"]);
    expect(reduced).toMatchObject({
      duration: 400,
      repeat: { times: 0 },
      targets: { type: "self" },
    });
    expect(reduced?.stagger.each).toBe(40);
  });

  it("fades entrances in when nothing calm is left", () => {
    const reduced = reduceMotion({ ...slideIn, tracks: [slideIn.tracks[0]!] });
    expect(reduced?.tracks).toEqual([
      {
        property: "opacity",
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 1, value: 1 },
        ],
      },
    ]);
    const exit = reduceMotion({
      ...slideIn,
      trigger: { type: "pageExit" },
      tracks: [slideIn.tracks[0]!],
    });
    expect(exit?.tracks[0]?.keyframes.map((keyframe) => keyframe.value)).toEqual([1, 0]);
  });

  it("drops hover movement with nothing calm to keep", () => {
    expect(
      reduceMotion({
        ...slideIn,
        trigger: { type: "hover", onLeave: "reverse" },
        tracks: [slideIn.tracks[0]!],
      }),
    ).toBeUndefined();
  });

  it("jumps to the end for 'instant', and shows a scroll scene's end once", () => {
    const reduced = reduceMotion({ ...slideIn, reducedMotion: "instant" });
    expect(reduced).toMatchObject({
      duration: 0,
      delay: 0,
      stagger: { each: 0 },
      repeat: { times: 0 },
    });
    const scene = reduceMotion({ ...findPreset("parallax-slow")!.spec, reducedMotion: "instant" });
    expect(scene?.trigger).toEqual({ type: "load" });
  });

  it("never follows the pointer", () => {
    const tilt = findPreset("hover-tilt")!.spec;
    expect(reduceMotion({ ...tilt, reducedMotion: "fade" })).toBeUndefined();
    expect(reduceMotion({ ...tilt, reducedMotion: "instant" })).toBeUndefined();
  });
});
