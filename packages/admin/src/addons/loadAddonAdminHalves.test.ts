import { ADDON_MODULES_GLOBAL, ADMIN_ADDON_MODULES } from "@lintel/core/addon-modules";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminPlugins } from "../plugins/adminPlugins.js";
import { mockApi } from "../testing/mockApi.js";
import { failedAddonAdminHalves, loadAddonAdminHalves } from "./loadAddonAdminHalves.js";
import { sharedAddonModules } from "./sharedAddonModules.js";

afterEach(() => vi.restoreAllMocks());

describe("loading add-ons' admin halves", () => {
  it("shares exactly the modules add-ons are built to expect", () => {
    expect(Object.keys(sharedAddonModules).sort()).toEqual([...ADMIN_ADDON_MODULES].sort());
  });

  it("adds the ones that load, and notes the ones that don't, without stopping", async () => {
    mockApi(({ url }) => {
      if (url.pathname !== "/addons/admin-scripts") throw new Response(null, { status: 404 });
      return {
        scripts: [
          { id: "swatches", script: "/addons/swatches/admin.js?v=1", styles: null },
          { id: "broken", script: "/addons/broken/admin.js?v=1", styles: null },
        ],
      };
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const imported: string[] = [];

    await loadAddonAdminHalves(async (url) => {
      imported.push(url);
      if (url.includes("broken")) throw new Error("Syntax error");
      return { default: { id: "swatches", sidebarItems: [] } };
    });

    expect(imported.map((url) => new URL(url).pathname)).toEqual([
      "/addons/swatches/admin.js",
      "/addons/broken/admin.js",
    ]);
    expect(adminPlugins.map((plugin) => plugin.id)).toContain("swatches");
    expect(failedAddonAdminHalves.has("broken")).toBe(true);
    expect((globalThis as Record<string, unknown>)[ADDON_MODULES_GLOBAL]).toBe(sharedAddonModules);
  });
});
