import { describe, expect, it } from "vitest";
import { safeRedirect } from "./SignInPage.js";

describe("safeRedirect", () => {
  it("returns to the page the person was trying to reach", () => {
    expect(safeRedirect("/content?tab=drafts")).toBe("/content?tab=drafts");
  });

  it("falls back to the dashboard when there's nowhere to return to", () => {
    expect(safeRedirect(undefined)).toBe("/");
  });

  it("refuses to send people to another site", () => {
    expect(safeRedirect("https://evil.example")).toBe("/");
    expect(safeRedirect("//evil.example")).toBe("/");
  });
});
