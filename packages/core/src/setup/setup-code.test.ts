import { describe, expect, it } from "vitest";
import { generateSetupCode, isLocalHostHeader, setupCodeMatches } from "./setup-code.js";

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

  it("only count as local when sent to this computer's own name", () => {
    for (const host of [
      "localhost",
      "localhost:4000",
      "127.0.0.1:4000",
      "[::1]:4000",
      "127.1.2.3",
    ]) {
      expect(isLocalHostHeader(host), host).toBe(true);
    }
    for (const host of [
      undefined,
      "",
      "cms.example.com",
      "localhost.example.com",
      "127.0.0.1.nip.io",
    ]) {
      expect(isLocalHostHeader(host), String(host)).toBe(false);
    }
  });
});
