import { describe, expect, it } from "vitest";
import { markerScrollOffset, pageProgress, sceneProgress } from "./scrollScene.js";

const wholeTrip = { start: { element: 0, viewport: 1 }, end: { element: 1, viewport: 0 } };

describe("scroll scenes", () => {
  it("run from the element entering at the bottom to leaving at the top", () => {
    const sizes = { elementHeight: 200, viewportHeight: 800 };
    expect(sceneProgress(wholeTrip, { ...sizes, elementTop: 900 })).toBe(0);
    expect(sceneProgress(wholeTrip, { ...sizes, elementTop: 800 })).toBe(0);
    expect(sceneProgress(wholeTrip, { ...sizes, elementTop: 300 })).toBe(0.5);
    expect(sceneProgress(wholeTrip, { ...sizes, elementTop: -200 })).toBe(1);
  });

  it("handle markers in the middle of the element and the screen", () => {
    const centre = { start: { element: 0.5, viewport: 0.5 }, end: { element: 0.5, viewport: 0 } };
    const sizes = { elementHeight: 200, viewportHeight: 1000 };
    expect(sceneProgress(centre, { ...sizes, elementTop: 400 })).toBe(0);
    expect(sceneProgress(centre, { ...sizes, elementTop: 150 })).toBe(0.5);
  });

  it("treat a scene with no length as a switch", () => {
    const sameMarker = { start: { element: 0, viewport: 0.5 }, end: { element: 0, viewport: 0.5 } };
    const sizes = { elementHeight: 100, viewportHeight: 1000 };
    expect(sceneProgress(sameMarker, { ...sizes, elementTop: 600 })).toBe(0);
    expect(sceneProgress(sameMarker, { ...sizes, elementTop: 400 })).toBe(1);
  });

  it("give the browser's view timeline the same markers in pixels", () => {
    expect(markerScrollOffset({ element: 0, viewport: 1 }, 200, 800)).toBe(0);
    expect(markerScrollOffset({ element: 1, viewport: 0 }, 200, 800)).toBe(1000);
  });

  it("measure page progress", () => {
    expect(pageProgress(500, 2000, 1000)).toBe(0.5);
    expect(pageProgress(0, 500, 1000)).toBe(1);
  });
});
