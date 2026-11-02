import { describe, expect, it } from "vitest";
import { type CanvasLook, lookAlign, nearestSizeChip } from "./canvas-look.js";

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
