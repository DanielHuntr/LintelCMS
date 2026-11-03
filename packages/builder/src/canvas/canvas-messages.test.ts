import { describe, expect, it } from "vitest";
import { readFrameMessage } from "./canvas-messages.js";

// The frame runs the page's own code, so nothing it sends is trusted until it's checked.
describe("messages from the canvas about dragging from Insert", () => {
  it("accepts where the pointer is, and leaving or letting go", () => {
    const over = { type: "insertOver", chain: [{ nodeId: "n3", ratio: 0.4, across: true }] };

    expect(readFrameMessage(over)).toEqual(over);
    expect(readFrameMessage({ type: "insertOver", chain: [] })).toEqual({
      type: "insertOver",
      chain: [],
    });
    expect(readFrameMessage({ type: "insertLeave" })).toEqual({ type: "insertLeave" });
    expect(readFrameMessage({ type: "insertDrop", extra: "ignored" })).toEqual({
      type: "insertDrop",
    });
  });

  it("refuses a chain that isn't one", () => {
    expect(readFrameMessage({ type: "insertOver", chain: "n3" })).toBeNull();
    expect(
      readFrameMessage({ type: "insertOver", chain: [{ nodeId: "n3", ratio: "half" }] }),
    ).toBeNull();
    expect(
      readFrameMessage({
        type: "insertOver",
        chain: Array.from({ length: 65 }, () => ({ nodeId: "n", ratio: 0, across: false })),
      }),
    ).toBeNull();
  });
});
