import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SetupStatus } from "./setup/setup.api.js";
import { setupStatus } from "./setup/testStatus.js";

const signedIn = {
  user: { id: "user-1", email: "daniel@gmail.com", name: "Daniel" },
  permissions: ["*"],
  enabledPlugins: ["blog", "seo"],
  siteName: "Brightside Bakery",
};

/** Answers the admin's requests the way the API would for this setup state. */
function fakeApi(status: SetupStatus, isSignedIn: boolean) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/setup/status") return Response.json(status);
    if (path === "/auth/me") {
      return isSignedIn
        ? Response.json(signedIn)
        : Response.json({ code: "NOT_SIGNED_IN", message: "Sign in" }, { status: 401 });
    }
    return Response.json({ code: "NOT_FOUND", message: "Not found" }, { status: 404 });
  });
}

/** Where the admin ends up after opening `path`. */
async function landingPathFor(path: string) {
  // A fresh copy of the routes each time: the setup check remembers a finished setup.
  const { routeTree } = await import("./router.js");
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  return router.state.location.pathname;
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.restoreAllMocks());

describe("where the admin sends people", () => {
  // The first import of the whole route tree can take longer than one test is allowed when
  // every package's tests run at once, which failed the first test now and then. It's loaded
  // once here, with time to spare, so no test is timed on it.
  beforeAll(async () => {
    await import("./router.js");
  }, 60_000);

  it("sends every address to /setup on a brand new Lintel, sign-in included", async () => {
    fakeApi(setupStatus({ needsSetup: true }), false);

    expect(await landingPathFor("/")).toBe("/setup");
    expect(await landingPathFor("/sign-in")).toBe("/setup");
    expect(await landingPathFor("/content")).toBe("/setup");
    expect(await landingPathFor("/setup")).toBe("/setup");
  });

  it("sends /setup to sign-in once the account exists", async () => {
    fakeApi(setupStatus({ needsSetup: false, siteSetupCompleted: true }), false);

    expect(await landingPathFor("/setup")).toBe("/sign-in");
  });

  it("sends /setup to the dashboard for someone signed in", async () => {
    fakeApi(setupStatus({ needsSetup: false, siteSetupCompleted: true }), true);

    expect(await landingPathFor("/setup")).toBe("/");
  });

  it("keeps the usual sign-in redirect once setup is complete", async () => {
    fakeApi(setupStatus({ needsSetup: false, siteSetupCompleted: true }), false);

    expect(await landingPathFor("/content")).toBe("/sign-in");
  });

  it("opens content in the workspace beside the tree, keeping the tab in the address", async () => {
    fakeApi(setupStatus({ needsSetup: false, siteSetupCompleted: true }), true);
    const { routeTree } = await import("./router.js");
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/content/pages/e1?tab=info"] }),
    });
    await router.load();

    expect(router.state.location.pathname).toBe("/content/pages/e1");
    expect(router.state.location.search).toMatchObject({ tab: "info" });
    expect(router.state.matches.some((match) => match.routeId.endsWith("content-section"))).toBe(
      true,
    );
    expect(await landingPathFor("/content/recycle-bin")).toBe("/content/recycle-bin");
    expect(await landingPathFor("/content/globals")).toBe("/content/globals");
  });
});
