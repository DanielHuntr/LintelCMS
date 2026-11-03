import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Canvas } from "./Canvas.js";
import type { MessageFromFrame } from "./canvas-messages.js";

function renderCanvas(isInsertDragging: boolean) {
  const onMessage = vi.fn<(message: MessageFromFrame) => void>();
  render(
    <Canvas
      html=""
      css=""
      breakpoint="desktop"
      selectedId={null}
      hoveredId={null}
      labels={{ selected: null, hovered: null }}
      revealId={null}
      canTransform={false}
      isInsertDragging={isInsertDragging}
      onMessage={onMessage}
    />,
  );
  return onMessage;
}

// Browsers don't carry a drag from the builder into the sandboxed frame, so dropping from
// Insert onto the page showed "not allowed" and did nothing.
describe("dropping from Insert onto the canvas", () => {
  it("catches the drag over the page while something from Insert is dragged", () => {
    const onMessage = renderCanvas(true);
    const layer = screen.getByTestId("canvas-drop-layer");

    const over = fireEvent.dragOver(layer, { dataTransfer: { dropEffect: "none" } });
    fireEvent.drop(layer, { dataTransfer: {} });

    // Not cancelled would mean the browser refuses the drop.
    expect(over).toBe(false);
    expect(onMessage).toHaveBeenCalledWith({ type: "insertDrop" });
  });

  it("leaves the page alone the rest of the time, so it can be clicked", () => {
    renderCanvas(false);
    expect(screen.queryByTestId("canvas-drop-layer")).not.toBeInTheDocument();
  });
});
