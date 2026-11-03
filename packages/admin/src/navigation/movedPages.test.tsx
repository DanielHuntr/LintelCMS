import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { newAddressFor, sendOnFromOldAddress } from "./movedPages.js";

describe("pages with new addresses", () => {
  it("knows the new address, keeping anything after the old one", () => {
    expect(newAddressFor("/settings/content-types")).toBe("/build/content-types");
    expect(newAddressFor("/settings/webhooks/abc")).toBe("/build/webhooks/abc");
    expect(newAddressFor("/settings/security-log")).toBe("/users/activity");
    // "/settings/site" stays; it isn't "/settings/sites".
    expect(newAddressFor("/settings/site")).toBeNull();
    expect(newAddressFor("/settings/sitesmap")).toBeNull();
  });

  // Bookmarks and links in old emails and docs pointed at Settings.
  it("sends an old address on to the new one, under the admin's own path", async () => {
    const rootRoute = createRootRoute();
    const router = createRouter({
      basepath: "/admin",
      history: createMemoryHistory({ initialEntries: ["/admin/settings/webhooks/abc?tab=log"] }),
      routeTree: rootRoute.addChildren([
        createRoute({ getParentRoute: () => rootRoute, path: "/build/webhooks/$webhookId" }),
        createRoute({
          getParentRoute: () => rootRoute,
          path: "$",
          beforeLoad: sendOnFromOldAddress,
        }),
      ]),
    });

    await router.load();

    // The address bar, which includes the admin's path.
    expect(router.history.location.pathname).toBe("/admin/build/webhooks/abc");
    expect(router.history.location.search).toBe("?tab=log");
  });
});
