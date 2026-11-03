import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyColorScheme,
  chooseColorScheme,
  currentColorScheme,
  readColorSchemeChoice,
} from "./colorScheme.js";

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.colorScheme;
  vi.unstubAllGlobals();
});

describe("the admin's colour scheme", () => {
  it("follows the device until someone chooses", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("dark") }));

    expect(readColorSchemeChoice()).toBe("device");
    expect(currentColorScheme("device")).toBe("dark");
    expect(document.documentElement.dataset.colorScheme).toBeUndefined();
  });

  it("remembers a choice and sets it on the page, and forgets it for the device's", () => {
    chooseColorScheme("dark");
    expect(document.documentElement.dataset.colorScheme).toBe("dark");
    expect(readColorSchemeChoice()).toBe("dark");
    expect(currentColorScheme("dark")).toBe("dark");

    chooseColorScheme("device");
    expect(document.documentElement.dataset.colorScheme).toBeUndefined();
    expect(readColorSchemeChoice()).toBe("device");
  });

  it("ignores anything else saved, and applies without saving", () => {
    window.localStorage.setItem("lintel.colorScheme", "sepia");
    expect(readColorSchemeChoice()).toBe("device");

    applyColorScheme("light");
    expect(document.documentElement.dataset.colorScheme).toBe("light");
    expect(window.localStorage.getItem("lintel.colorScheme")).toBe("sepia");
  });
});
