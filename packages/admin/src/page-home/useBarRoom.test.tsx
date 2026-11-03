import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBarRoom } from "./useBarRoom.js";

let report: (width: number) => void = () => undefined;

class FakeResizeObserver {
  constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
    report = (width) => callback([{ contentRect: { width } }]);
  }
  observe() {}
  disconnect() {}
}

describe("the room in a page's top bar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("assumes plenty until it has measured", () => {
    const { result } = renderHook(() => useBarRoom(null));

    expect(result.current).toEqual({ isTight: false, movesSwitch: false });
  });

  it.each([
    [900, { isTight: false, movesSwitch: false }],
    [640, { isTight: true, movesSwitch: false }],
    [420, { isTight: true, movesSwitch: true }],
  ])("at %ipx of page area", (width, room) => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const element = document.createElement("div");
    const { result } = renderHook(() => useBarRoom(element));

    act(() => report(width));

    expect(result.current).toEqual(room);
  });
});
