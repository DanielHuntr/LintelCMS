import { describe, expect, it } from "vitest";
import type { Track } from "../spec/motion.schema.js";
import { buildKeyframes, composeFrame } from "./buildKeyframes.js";
import { composeGroupValue, cssNameOf } from "./composeGroup.js";
import { sampleTrack } from "./sampleTrack.js";
import { formatNumericValue, parseNumericValue } from "./values.js";

const options = { supportsLinearFunction: true };

function track(
  property: Track["property"],
  values: Array<number | string>,
  offsets?: number[],
): Track {
  return {
    property,
    keyframes: values.map((value, index) => ({
      offset: offsets?.[index] ?? index / (values.length - 1),
      value,
    })),
  };
}

describe("values", () => {
  it("read numbers with or without units", () => {
    expect(parseNumericValue(20, "px")).toEqual({ amount: 20, unit: "px" });
    expect(parseNumericValue("-50%", "px")).toEqual({ amount: -50, unit: "%" });
    expect(parseNumericValue(".5turn", "deg")).toEqual({ amount: 0.5, unit: "turn" });
    expect(parseNumericValue("inset(0)", "")).toBeUndefined();
    expect(formatNumericValue({ amount: -0.000001, unit: "px" })).toBe("0px");
  });
});

describe("composing a CSS value from the tracks that share it", () => {
  it("fills the missing axes of translate and multiplies scales", () => {
    expect(composeGroupValue("translate", new Map([["translateY", 20]]))).toBe("0px 20px");
    expect(composeGroupValue("translate", new Map([["translateZ", 5]]))).toBe("0px 0px 5px");
    expect(
      composeGroupValue(
        "scale",
        new Map([
          ["scale", 2],
          ["scaleY", 0.5],
        ]),
      ),
    ).toBe("2 1");
    expect(composeGroupValue("scale", new Map([["scale", 1.5]]))).toBe("1.5");
  });

  it("lists transform and filter functions in a fixed order", () => {
    const values = new Map<Track["property"], number>([
      ["rotateY", 10],
      ["perspective", 800],
    ]);
    expect(composeGroupValue("transform", values)).toBe("perspective(800px) rotateY(10deg)");
    expect(
      composeGroupValue(
        "filter",
        new Map([
          ["saturate", 2],
          ["blur", 4],
        ]),
      ),
    ).toBe("blur(4px) saturate(2)");
  });

  it("passes text through and spells properties for CSS", () => {
    expect(composeGroupValue("clipPath", new Map([["clipPath", "inset(10%)"]]))).toBe("inset(10%)");
    expect(composeGroupValue("rotate", new Map([["rotate", 45]]))).toBe("45deg");
    expect(cssNameOf("backgroundColor")).toBe("background-color");
    expect(cssNameOf("--glow")).toBe("--glow");
  });
});

describe("sampling a track", () => {
  it("holds before the first keyframe and after the last", () => {
    const fade = track("opacity", [0, 1], [0.25, 0.75]);
    expect(sampleTrack(fade, 0, "linear")).toBe("0");
    expect(sampleTrack(fade, 0.5, "linear")).toBe("0.5");
    expect(sampleTrack(fade, 1, "linear")).toBe("1");
  });

  it("uses each keyframe's own easing before the default", () => {
    const eased: Track = {
      property: "translateX",
      keyframes: [
        { offset: 0, value: 0, easing: { type: "steps", count: 2, position: "end" } },
        { offset: 1, value: 100 },
      ],
    };
    expect(sampleTrack(eased, 0.4, "linear")).toBe("0px");
    expect(sampleTrack(eased, 0.6, "linear")).toBe("50px");
  });
});

describe("building Web Animations keyframes", () => {
  it("keeps a lone track's keyframes and easings exactly", () => {
    const [opacity] = buildKeyframes([track("opacity", [0, 1])], "easeOut", options);
    expect(opacity).toMatchObject({
      keyframeKey: "opacity",
      keyframes: [
        { offset: 0, opacity: "0", easing: "cubic-bezier(0, 0, 0.58, 1)" },
        { offset: 1, opacity: "1" },
      ],
    });
  });

  it("merges tracks that line up into one set of keyframes", () => {
    const [translate] = buildKeyframes(
      [track("translateX", [0, 10]), track("translateY", [5, 0])],
      "linear",
      options,
    );
    expect(translate?.keyframes.map((keyframe) => keyframe.translate)).toEqual([
      "0px 5px",
      "10px 0px",
    ]);
  });

  it("samples tracks that share a property but not their timing", () => {
    const [translate] = buildKeyframes(
      [track("translateX", [0, 100]), track("translateY", [0, 50], [0.5, 1])],
      "linear",
      options,
    );
    const keyframes = translate?.keyframes ?? [];
    expect(keyframes.length).toBeGreaterThan(20);
    expect(keyframes.every((keyframe) => keyframe.easing === "linear")).toBe(true);
    expect(keyframes.find((keyframe) => keyframe.offset === 0.5)?.translate).toBe("50px 0px");
  });

  it("gives every CSS property its own set, in a stable order", () => {
    const plans = buildKeyframes(
      [track("blur", [4, 0]), track("opacity", [0, 1]), track("--glow", ["0", "1"])],
      "linear",
      options,
    );
    expect(plans.map((plan) => plan.keyframeKey)).toEqual(["opacity", "filter", "--glow"]);
  });

  it("composes one frame for pointer animations", () => {
    const frame = composeFrame(
      [
        { ...track("rotateY", [-10, 10]), input: "x" },
        { ...track("rotateX", [10, -10]), input: "y" },
      ],
      (current) => (current.input === "x" ? 1 : 0.5),
      "linear",
    );
    expect(frame.get("transform")).toBe("rotateX(0deg) rotateY(10deg)");
  });
});
