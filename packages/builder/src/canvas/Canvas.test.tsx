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
      breakpoint="base"
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

describe("the canvas and the keyboard", () => {
  it("keeps the page's links out of the Tab order (LINTEL-A11Y-029)", () => {
    renderCanvas(false);
    // tabindex -1 on a frame takes it and everything in it out of the Tab order.
    expect(screen.getByTitle("Your page")).toHaveAttribute("tabindex", "-1");
  });
});

describe("zooming the canvas", () => {
  it("zooms out and in with its buttons and the keys, and back to actual size", () => {
    renderCanvas(false);
    const actual = () => screen.getByRole("button", { name: /^Zoom \d+%/ });
    expect(actual()).toHaveTextContent("100%");
    fireEvent.click(screen.getByRole("button", { name: "Zoom out (Ctrl −)" }));
    expect(actual()).toHaveTextContent("90%");
    fireEvent.keyDown(window, { key: "-", ctrlKey: true });
    expect(actual()).toHaveTextContent("75%");
    fireEvent.keyDown(window, { key: "=", ctrlKey: true });
    expect(actual()).toHaveTextContent("90%");
    fireEvent.click(actual());
    expect(actual()).toHaveTextContent("100%");
  });

  it("zooms with Ctrl and the wheel, but leaves keys typed into a field alone", () => {
    renderCanvas(false);
    fireEvent.wheel(screen.getByTestId("canvas-area"), { deltaY: 60, ctrlKey: true });
    expect(screen.getByRole("button", { name: /^Zoom \d+%/ })).toHaveTextContent("86%");
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "-", ctrlKey: true });
    expect(screen.getByRole("button", { name: /^Zoom \d+%/ })).toHaveTextContent("86%");
    input.remove();
  });
});

// Words being typed on the page only reach the builder when typing ends, so leaving the
// builder straight after typing would otherwise leave them behind.
describe("keeping words still being typed", () => {
  function renderWithRef() {
    const finishEditingRef: { current: (() => Promise<void>) | null } = { current: null };
    const { container } = render(
      <Canvas
        finishEditingRef={finishEditingRef}
        html=""
        css=""
        breakpoint="base"
        selectedId={null}
        hoveredId={null}
        labels={{ selected: null, hovered: null }}
        revealId={null}
        canTransform={false}
        isInsertDragging={false}
        onMessage={() => undefined}
      />,
    );
    const frame = container.querySelector("iframe") as HTMLIFrameElement;
    return { finishEditingRef, frameWindow: frame.contentWindow as Window };
  }

  it("asks the frame to finish, and waits for its answer", async () => {
    const { finishEditingRef, frameWindow } = renderWithRef();
    const post = vi.spyOn(frameWindow, "postMessage");
    let isDone = false;

    const finishing = finishEditingRef.current?.().then(() => {
      isDone = true;
    });
    await Promise.resolve();

    expect(post).toHaveBeenCalledWith({ type: "finishEditing" }, "*");
    expect(isDone).toBe(false);
    window.dispatchEvent(
      new MessageEvent("message", { source: frameWindow, data: { type: "editingFinished" } }),
    );
    await finishing;
    expect(isDone).toBe(true);
  });

  it("doesn't wait for ever if the frame never answers", async () => {
    vi.useFakeTimers();
    const { finishEditingRef } = renderWithRef();

    const finishing = finishEditingRef.current?.();
    await vi.advanceTimersByTimeAsync(500);
    await finishing;
    vi.useRealTimers();
  });
});
