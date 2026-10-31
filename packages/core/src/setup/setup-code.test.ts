import { describe, expect, it } from "vitest";
import { generateSetupCode, setupCodeMatches } from "./setup-code.js";

describe("setup codes", () => {
  it("are eight random digits, shown in two groups", () => {
    const codes = new Set(Array.from({ length: 20 }, generateSetupCode));

    for (const code of codes) {
      expect(code).toMatch(/^\d{4}-\d{4}$/);
    }
    expect(codes.size).toBeGreaterThan(15);
  });

  it("match with or without the dash and spaces, and nothing else", () => {
    expect(setupCodeMatches("4821-0937", "4821-0937")).toBe(true);
    expect(setupCodeMatches("4821-0937", " 4821 0937 ")).toBe(true);
    expect(setupCodeMatches("4821-0937", "4821-0938")).toBe(false);
    expect(setupCodeMatches("4821-0937", "4821")).toBe(false);
    expect(setupCodeMatches("4821-0937", "")).toBe(false);
  });
});
