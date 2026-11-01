import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autosaveDelayMs, useAutosave } from "./useAutosave.js";

interface Props {
  draft: string;
  hasUnsavedChanges: boolean;
  isEnabled?: boolean;
}

function renderAutosave(save: (draft: string) => Promise<unknown>, initial: Props) {
  return renderHook(
    ({ draft, hasUnsavedChanges, isEnabled = true }: Props) =>
      useAutosave({ draft, hasUnsavedChanges, isEnabled, save }),
    { initialProps: initial },
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useAutosave", () => {
  it("saves once typing has paused for the delay", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderAutosave(save, { draft: "H", hasUnsavedChanges: true });

    await act(() => vi.advanceTimersByTimeAsync(1000));
    rerender({ draft: "He", hasUnsavedChanges: true });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(autosaveDelayMs));
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("He", { saveVersion: false });
  });

  it("does nothing when there's nothing new, or saving isn't possible yet", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderAutosave(save, { draft: "Saved", hasUnsavedChanges: false });
    await act(() => vi.advanceTimersByTimeAsync(autosaveDelayMs * 2));

    rerender({ draft: "", hasUnsavedChanges: true, isEnabled: false });
    await act(() => vi.advanceTimersByTimeAsync(autosaveDelayMs * 2));

    expect(save).not.toHaveBeenCalled();
  });

  it("saves straight away with saveNow, as for Cmd/Ctrl+S", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderAutosave(save, { draft: "Now", hasUnsavedChanges: true });

    await act(() => result.current.saveNow({ saveVersion: true }));

    expect(save).toHaveBeenCalledWith("Now", { saveVersion: true });
  });

  it("runs one save at a time, then sends whatever is newest", async () => {
    let finishFirstSave = () => undefined as void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirstSave = resolve)))
      .mockResolvedValue(undefined);
    const { result, rerender } = renderAutosave(save, { draft: "One", hasUnsavedChanges: true });

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.saveNow();
    });
    rerender({ draft: "One two", hasUnsavedChanges: true });
    let second: Promise<void> = Promise.resolve();
    act(() => {
      second = result.current.saveNow();
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishFirstSave();
      await first;
      await second;
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("One two", { saveVersion: false });
  });

  it("doesn't retry a failed save on a loop", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Offline"));
    renderAutosave(save, { draft: "Lost?", hasUnsavedChanges: true });

    await act(() => vi.advanceTimersByTimeAsync(autosaveDelayMs * 5));

    expect(save).toHaveBeenCalledOnce();
  });
});
