import { describe, expect, it } from "vitest";
import { formatColumnValue } from "./columnValues.js";
import { readWorkspaceTab } from "./workspaceTabs.js";

describe("list column values", () => {
  it("shows plain values as short text and leaves out what a cell can't show", () => {
    expect(formatColumnValue("Crusty  sourdough\nloaf")).toBe("Crusty sourdough loaf");
    expect(formatColumnValue(1250)).toBe((1250).toLocaleString());
    expect(formatColumnValue(true)).toBe("Yes");
    expect(formatColumnValue(["red", "green"])).toBe("red, green");
    expect(formatColumnValue(["3f2c1d9e-0a6b-4c1e-9d2f-7b8a6c5d4e3f"])).toBe("");
    expect(formatColumnValue({ type: "doc" })).toBe("");
    expect(formatColumnValue(null)).toBe("");
    expect(formatColumnValue("x".repeat(100))).toHaveLength(80);
  });
});

describe("what an entry shows, from the address", () => {
  it("reads the items view, and opens the fields for anything else", () => {
    expect(readWorkspaceTab("children")).toBe("children");
    // The old Settings, History and Info tabs are in the editor's side panel and menu now.
    expect(readWorkspaceTab("info")).toBeUndefined();
    expect(readWorkspaceTab("nonsense")).toBeUndefined();
  });
});
