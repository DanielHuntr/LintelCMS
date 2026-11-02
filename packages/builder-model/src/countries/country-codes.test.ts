import { describe, expect, it } from "vitest";
import { countryCodes, isKnownCountryCode } from "./country-codes.js";

describe("the countries a shop can sell to", () => {
  // Asking Intl about every pair of letters listed retired codes too, so "United Kingdom"
  // showed twice (GB and UK) and codes no payment provider knows could be saved.
  it("are the ISO 3166 codes, each once, without retired or reserved ones", () => {
    expect(new Set(countryCodes).size).toBe(countryCodes.length);
    expect(countryCodes).toHaveLength(250);
    for (const retired of ["UK", "FX", "DD", "CS", "YU", "SU", "AN", "EU", "UN", "ZZ"]) {
      expect(isKnownCountryCode(retired)).toBe(false);
    }
    expect(isKnownCountryCode("GB")).toBe(true);
    expect(isKnownCountryCode("XK")).toBe(true);
  });

  it("each have a name", () => {
    const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
    const unnamed = countryCodes.filter((code) => !names.of(code));
    expect(unnamed).toEqual([]);
    const counts = new Map<string, number>();
    for (const code of countryCodes) {
      const name = names.of(code) ?? code;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    expect([...counts].filter(([, count]) => count > 1)).toEqual([]);
  });
});
