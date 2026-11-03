import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_VISIBLE_FOR_MS, Toast, ToastProvider, useToast } from "./Toast.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const notice = {
  id: 1,
  tone: "neutral" as const,
  message: "Moved “About” to the recycle bin.",
};

describe("Toast", () => {
  it("is announced politely and goes by itself after about eight seconds", () => {
    const onDismiss = vi.fn();
    render(<Toast notice={notice} onDismiss={onDismiss} />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent("Moved “About” to the recycle bin.");
    act(() => vi.advanceTimersByTime(TOAST_VISIBLE_FOR_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("stays while focused or hovered, and goes eight seconds after", () => {
    const onDismiss = vi.fn();
    const undo = vi.fn();
    render(
      <Toast
        notice={{ ...notice, actions: [{ label: "Undo", run: undo }] }}
        onDismiss={onDismiss}
      />,
    );
    const button = screen.getByRole("button", { name: "Undo" });

    act(() => button.focus());
    act(() => vi.advanceTimersByTime(TOAST_VISIBLE_FOR_MS * 3));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => button.blur());
    fireEvent.pointerEnter(button.parentElement as HTMLElement);
    act(() => vi.advanceTimersByTime(TOAST_VISIBLE_FOR_MS * 3));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerLeave(button.parentElement as HTMLElement);
    act(() => vi.advanceTimersByTime(TOAST_VISIBLE_FOR_MS));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("takes focus to its first button with Alt+T", () => {
    render(
      <Toast
        notice={{ ...notice, actions: [{ label: "Undo", run: vi.fn() }] }}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: "t", code: "KeyT", altKey: true });

    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Alt+T",
    );
  });

  it("runs an action from the keyboard and then goes", () => {
    const onDismiss = vi.fn();
    const undo = vi.fn();
    render(
      <Toast
        notice={{ ...notice, actions: [{ label: "Undo", run: undo }] }}
        onDismiss={onDismiss}
      />,
    );

    const button = screen.getByRole("button", { name: "Undo" });
    act(() => button.focus());
    fireEvent.click(button);

    expect(undo).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("shows notes from anywhere inside the provider, a new one replacing the last", () => {
    function Saver() {
      const show = useToast();
      return (
        <>
          <button type="button" onClick={() => show({ tone: "neutral", message: "First" })}>
            first
          </button>
          <button type="button" onClick={() => show({ tone: "danger", message: "Second" })}>
            second
          </button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Saver />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "first" }));
    fireEvent.click(screen.getByRole("button", { name: "second" }));

    expect(screen.getByRole("status")).toHaveTextContent("Second");
    expect(screen.getByRole("status")).not.toHaveTextContent("First");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
