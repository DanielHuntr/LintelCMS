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

  // Dragging an element on the page moved nothing: it could only be moved in Layers.
  it("accepts an element being dragged to a new place, and refuses one without a name", () => {
    const over = {
      type: "moveOver",
      nodeId: "n2",
      chain: [{ nodeId: "n5", ratio: 0.8, across: false }],
    };

    expect(readFrameMessage(over)).toEqual(over);
    expect(readFrameMessage({ type: "moveDrop", nodeId: "n2" })).toEqual({
      type: "moveDrop",
      nodeId: "n2",
    });
    expect(readFrameMessage({ type: "moveCancel" })).toEqual({ type: "moveCancel" });
    expect(readFrameMessage({ type: "moveOver", chain: [] })).toBeNull();
    expect(readFrameMessage({ type: "moveDrop" })).toBeNull();
  });

  it("reads a moved scroll scene line, and nothing out of range", () => {
    const moved = { type: "sceneMarker", which: "end", viewport: 0.4 };
    expect(readFrameMessage(moved)).toEqual(moved);
    expect(readFrameMessage({ type: "sceneMarker", which: "middle", viewport: 0.4 })).toBeNull();
    expect(readFrameMessage({ type: "sceneMarker", which: "start", viewport: 7 })).toBeNull();
  });
});
