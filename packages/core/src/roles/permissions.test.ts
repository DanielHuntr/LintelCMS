import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions.js";

describe("hasPermission", () => {
  it("allows an exact match", () => {
    expect(hasPermission(["entries:publish"], "entries:publish")).toBe(true);
  });

  it("allows everything for a super admin", () => {
    expect(hasPermission(["*"], "settings:update")).toBe(true);
  });

  it("allows every action in an area with an area wildcard", () => {
    expect(hasPermission(["entries:*"], "entries:delete")).toBe(true);
  });

  it("does not let one area's wildcard leak into another", () => {
    expect(hasPermission(["entries:*"], "orders:refund")).toBe(false);
  });

  it("denies anything not granted", () => {
    expect(hasPermission(["entries:read"], "entries:publish")).toBe(false);
  });
});
