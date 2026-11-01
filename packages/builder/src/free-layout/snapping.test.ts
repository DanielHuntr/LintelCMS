import { describe, expect, it } from "vitest";
import { snapBox, toPercentPlace } from "./snapping.js";

const frame = { width: 1000, height: 600 };

describe("snapping a dragged element", () => {
  it("snaps to the section’s edges and middle, with a guide for each", () => {
    expect(snapBox({ left: 4, top: 297 - 50, width: 200, height: 100 }, [], frame, 6)).toEqual({
      left: 0,
      top: 250,
      guides: [
        { axis: "x", position: 0 },
        { axis: "y", position: 300 },
      ],
    });
    // Its middle lines up with the section's middle.
    expect(snapBox({ left: 403, top: 40, width: 200, height: 100 }, [], frame, 6)).toEqual({
      left: 400,
      top: 40,
      guides: [{ axis: "x", position: 500 }],
    });
  });

  it("lines up with other elements’ edges, taking the closest", () => {
    const other = { left: 300, top: 100, width: 100, height: 50 };
    const snapped = snapBox({ left: 402, top: 152, width: 80, height: 40 }, [other], frame, 6);
    expect(snapped).toEqual({
      left: 400,
      top: 150,
      guides: [
        { axis: "x", position: 400 },
        { axis: "y", position: 150 },
      ],
    });
  });

  it("leaves it where it is when nothing is close", () => {
    expect(snapBox({ left: 120, top: 77, width: 80, height: 40 }, [], frame, 6)).toEqual({
      left: 120,
      top: 77,
      guides: [],
    });
  });

  it("turns pixels into percentages of the section", () => {
    expect(toPercentPlace(250, 150, frame)).toEqual({ left: 25, top: 25 });
    expect(toPercentPlace(10, 10, { width: 0, height: 0 })).toEqual({ left: 0, top: 0 });
  });
});
