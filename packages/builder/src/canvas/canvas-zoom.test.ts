import { describe, expect, it } from "vitest";
import { clampZoom, fitZoom, stepZoom, zoomFromWheel, zoomKey } from "./canvas-zoom.js";

const key = (pressed: Partial<Parameters<typeof zoomKey>[0]>) =>
  zoomKey({ key: "", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...pressed });

describe("canvas zoom", () => {
  it("steps in and out, from between steps too, and stays in range", () => {
    expect(stepZoom(1, "out")).toBe(0.9);
    expect(stepZoom(1, "in")).toBe(1.25);
    expect(stepZoom(0.8, "out")).toBe(0.75);
    expect(stepZoom(2, "in")).toBe(2);
    expect(stepZoom(0.25, "out")).toBe(0.25);
    expect(clampZoom(9)).toBe(2);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("follows the wheel and pinches smoothly", () => {
    expect(zoomFromWheel(1, -60)).toBeGreaterThan(1);
    expect(zoomFromWheel(1, 60)).toBeLessThan(1);
    expect(zoomFromWheel(1, 6000)).toBe(zoomFromWheel(1, 60));
  });

  it("knows its keys", () => {
    expect(key({ key: "=", ctrlKey: true })).toBe("in");
    expect(key({ key: "-", metaKey: true })).toBe("out");
    expect(key({ key: "0", ctrlKey: true })).toBe("actual");
    expect(key({ key: "!", shiftKey: true })).toBe("fit");
    expect(key({ key: "-" })).toBeNull();
    expect(key({ key: "=", ctrlKey: true, altKey: true })).toBeNull();
  });

  it("fits a frame into the room there is, never past actual size", () => {
    expect(fitZoom(768, 384)).toBe(0.5);
    expect(fitZoom(390, 1200)).toBe(1);
    expect(fitZoom(0, 100)).toBe(1);
  });
});
