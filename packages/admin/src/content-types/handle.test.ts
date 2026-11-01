import { describe, expect, it } from "vitest";
import { cleanTypedHandle, handleFromLabel, isValidHandle, uniqueHandle } from "./handle.js";

describe("handleFromLabel", () => {
  it("turns a label into a handle templates can use", () => {
    expect(handleFromLabel("Hero image")).toBe("hero_image");
    expect(handleFromLabel("  Reading time (minutes) ")).toBe("reading_time_minutes");
    expect(handleFromLabel("Q&A")).toBe("q_and_a");
    expect(handleFromLabel("Crème brûlée")).toBe("creme_brulee");
  });

  it("always starts with a letter", () => {
    expect(handleFromLabel("3D model")).toBe("field_3d_model");
    expect(handleFromLabel("2026 events", "type")).toBe("type_2026_events");
  });

  it("is empty when the label has nothing to use", () => {
    expect(handleFromLabel("???")).toBe("");
  });
});

describe("handles typed by hand", () => {
  it("swap characters that aren't allowed for underscores as you type", () => {
    expect(cleanTypedHandle("Hero Image")).toBe("hero_image");
  });

  it("are checked against the API's rule", () => {
    expect(isValidHandle("hero_image")).toBe(true);
    expect(isValidHandle("_hero")).toBe(false);
    expect(isValidHandle("1st")).toBe(false);
  });
});

describe("uniqueHandle", () => {
  it("adds a number when the handle is taken", () => {
    expect(uniqueHandle("body", ["title"])).toBe("body");
    expect(uniqueHandle("body", ["body", "body_2"])).toBe("body_3");
  });
});
