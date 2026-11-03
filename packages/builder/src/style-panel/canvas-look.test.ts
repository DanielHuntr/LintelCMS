import { describe, expect, it } from "vitest";
import { readFrameMessage } from "../canvas/canvas-messages.js";
import {
  type CanvasLook,
  countGridColumns,
  lookAlign,
  nearestSizeChip,
  nearestWeightChip,
} from "./canvas-look.js";

const look = (overrides: Partial<CanvasLook>): CanvasLook => ({
  nodeId: "n1",
  textAlign: "start",
  fontSize: 16,
  fontWeight: "400",
  color: "rgb(0, 0, 0)",
  ...overrides,
});

const sizes = [undefined, "0.875rem", "1.25rem", "2rem", "3.5rem"];

// A heading the theme made giant and centred read "Normal" and "Left" in the style panel.
describe("showing how the selected element looks", () => {
  it("names the size chip nearest the measured size, when one is close", () => {
    expect(nearestSizeChip(look({ fontSize: 56 }), sizes)).toBe("3.5rem");
    expect(nearestSizeChip(look({ fontSize: 30 }), sizes)).toBe("2rem");
    expect(nearestSizeChip(look({ fontSize: 16 }), sizes)).toBeUndefined();
    expect(nearestSizeChip(look({ fontSize: 120 }), sizes)).toBeNull();
    expect(nearestSizeChip(null, sizes)).toBeNull();
  });

  it("reads alignment as the panel names it", () => {
    expect(lookAlign(look({ textAlign: "center" }))).toBe("center");
    expect(lookAlign(look({ textAlign: "start" }))).toBe("left");
    expect(lookAlign(look({ textAlign: "end" }))).toBe("right");
    expect(lookAlign(null)).toBeUndefined();
  });
});

describe("the canvas's look message", () => {
  // The builder only takes messages it knows, and dropped the canvas's measurements.
  it("is read when it is well formed, and refused otherwise", () => {
    const sent = {
      type: "look",
      nodeId: "n1",
      textAlign: "center",
      fontSize: 56,
      fontWeight: "700",
      color: "rgb(0, 0, 0)",
    };
    expect(readFrameMessage(sent)).toEqual(sent);
    expect(readFrameMessage({ ...sent, fontSize: "big" })).toBeNull();
  });
});

describe("chips that match the real look (QA sweep)", () => {
  const weights = ["400", "500", "700"];

  it("reads a 600 button as Bold, and bold or normal by name", () => {
    expect(nearestWeightChip("600", weights)).toBe("700");
    expect(nearestWeightChip("bold", weights)).toBe("700");
    expect(nearestWeightChip("normal", weights)).toBe("400");
    expect(nearestWeightChip("450", weights)).toBe("500");
    expect(nearestWeightChip("900", weights)).toBeNull();
    expect(nearestWeightChip("var(--lintel-var-weight)", weights)).toBeNull();
    expect(nearestWeightChip(undefined, weights)).toBeNull();
  });

  it("counts a grid's columns however its template is written", () => {
    expect(countGridColumns("repeat(3, minmax(0, 1fr))")).toBe(3);
    expect(countGridColumns("1fr 1fr")).toBe(2);
    expect(countGridColumns("minmax(0, 2fr) 1fr  [wide] 1fr")).toBe(3);
    expect(countGridColumns("repeat(auto-fill, minmax(12rem, 1fr))")).toBe(0);
    expect(countGridColumns(undefined)).toBe(0);
  });
});
