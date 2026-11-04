import { describe, expect, it } from "vitest";
import { builtInRoles } from "./built-in-roles.js";
import { hasPermission } from "./permissions.js";

describe("the built-in roles", () => {
  it("give no permission that nothing checks (LINTEL-SPEC-005)", () => {
    const admin = builtInRoles.find((role) => role.handle === "admin");

    expect(admin?.permissions).not.toContain("orders:*");
  });
});

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
