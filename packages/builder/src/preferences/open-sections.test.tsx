import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMemoryPreferenceStore } from "./builder-preferences.js";
import { useLastUsedOpenSections, useRememberedOpenSections } from "./open-sections.js";

describe("remembering open sections", () => {
  it("starts with the defaults, then remembers every section left open", () => {
    const store = createMemoryPreferenceStore();
    const first = renderHook(() => useRememberedOpenSections(store, "panel", ["layout"]));
    expect(first.result.current.isOpen("layout")).toBe(true);
    act(() => first.result.current.toggle("layout"));
    act(() => first.result.current.toggle("text"));
    expect(store.read("panel")).toBe("text");

    const again = renderHook(() => useRememberedOpenSections(store, "panel", ["layout"]));
    expect(again.result.current.isOpen("layout")).toBe(false);
    expect(again.result.current.isOpen("text")).toBe(true);
  });

  it("opens only the section used last when coming back", () => {
    const store = createMemoryPreferenceStore();
    const first = renderHook(() => useLastUsedOpenSections(store, "advanced"));
    expect(first.result.current.isOpen("size")).toBe(false);
    act(() => first.result.current.toggle("size"));
    act(() => first.result.current.markUsed("effects"));
    expect(first.result.current.isOpen("size")).toBe(true);

    const again = renderHook(() => useLastUsedOpenSections(store, "advanced"));
    expect(again.result.current.isOpen("effects")).toBe(true);
    expect(again.result.current.isOpen("size")).toBe(false);
  });
});
