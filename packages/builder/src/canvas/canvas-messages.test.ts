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

  it("reads a place on a placed grid, and refuses lines that aren't whole numbers from 1", () => {
    const placed = {
      type: "gridPlace",
      nodeId: "n4",
      column: 2,
      columnSpan: 5,
      row: 1,
      rowSpan: 2,
    };
    expect(readFrameMessage(placed)).toEqual(placed);
    expect(readFrameMessage({ ...placed, column: 0 })).toBeNull();
    expect(readFrameMessage({ ...placed, rowSpan: 1.5 })).toBeNull();
    expect(readFrameMessage({ ...placed, nodeId: undefined })).toBeNull();
  });

  it("reads a zoom from the wheel, and nothing that isn't a number", () => {
    expect(readFrameMessage({ type: "zoomWheel", deltaY: -12 })).toEqual({
      type: "zoomWheel",
      deltaY: -12,
    });
    expect(readFrameMessage({ type: "zoomWheel", deltaY: "lots" })).toBeNull();
  });
});

describe("messages from the canvas about a menu's links", () => {
  it("accepts the link clicked, and refuses one that isn't a menu item", () => {
    const picked = { type: "select", nodeId: "n4", menuItem: { id: "contact", label: "Contact" } };
    expect(readFrameMessage(picked)).toEqual(picked);
    expect(readFrameMessage({ type: "select", nodeId: "n4" })).toEqual({
      type: "select",
      nodeId: "n4",
    });
    expect(
      readFrameMessage({ type: "select", nodeId: "n4", menuItem: { id: 'x"]', label: "X" } }),
    ).toBeNull();
    expect(readFrameMessage({ type: "select", nodeId: "n4", menuItem: "contact" })).toBeNull();
  });
});

describe("the answer to finishing typing", () => {
  it("is understood", () => {
    expect(readFrameMessage({ source: "lintel-canvas", type: "editingFinished" })).toEqual({
      type: "editingFinished",
    });
  });
});
