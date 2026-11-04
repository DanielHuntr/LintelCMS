import { describe, expect, it } from "vitest";
import { canOpenPath } from "./sectionAccess.js";

const client = [
  "entries:read",
  "entries:create",
  "entries:update",
  "entries:publish",
  "media:read",
  "media:upload",
  "navigation:read",
  "globals:read",
];
const editor = [
  "entries:*",
  "builder:design",
  "media:*",
  "navigation:*",
  "terms:*",
  "globals:read",
  "globals:update",
  "analytics:read",
];

describe("opening an area of the admin by its address (LINTEL-UX-324)", () => {
  it("keeps a client out of what isn't theirs", () => {
    for (const path of ["/settings", "/settings/site", "/build", "/build/apps", "/users"]) {
      expect(canOpenPath(path, client), path).toBe(false);
    }
    expect(canOpenPath("/design", client)).toBe(false);
  });

  it("leaves a client everything they work with", () => {
    for (const path of ["/", "/content", "/content/pages/1", "/media", "/account", "/help"]) {
      expect(canOpenPath(path, client), path).toBe(true);
    }
  });

  it("lets an owner and an editor reach their own screens", () => {
    for (const path of ["/settings", "/build", "/users", "/design", "/commerce/orders"]) {
      expect(canOpenPath(path, ["*"]), path).toBe(true);
    }
    expect(canOpenPath("/design/blocks", editor)).toBe(true);
    expect(canOpenPath("/visitors", editor)).toBe(true);
    expect(canOpenPath("/settings", editor)).toBe(false);
  });

  it("opens one screen for a role made for just that job", () => {
    expect(canOpenPath("/settings/backups", ["backups:read"])).toBe(true);
    expect(canOpenPath("/settings/privacy", ["privacy:manage"])).toBe(true);
    expect(canOpenPath("/users/activity", ["security:read"])).toBe(true);
    expect(canOpenPath("/build/branding", ["branding:update"])).toBe(true);
    expect(canOpenPath("/commerce/orders", ["commerce:read-orders"])).toBe(true);
  });

  it("doesn't mistake one address for another that starts the same", () => {
    expect(canOpenPath("/settings-old", client)).toBe(true);
  });

  it("asks for the permission a plugin's sidebar item names", () => {
    const plugins = [
      {
        id: "forms",
        sidebarItems: [
          { path: "/forms", label: "Forms", icon: () => null, permission: "forms:read" },
        ],
      },
    ] as never;
    expect(canOpenPath("/forms/settings", client, plugins)).toBe(false);
    expect(canOpenPath("/forms", ["forms:*"], plugins)).toBe(true);
  });
});
