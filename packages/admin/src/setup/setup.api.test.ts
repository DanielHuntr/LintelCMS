import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseDatabase, createFirstAccount, saveSiteSetup } from "./setup.api.js";

function respondWith(status: number, body: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

function sentRequest(fetchSpy: ReturnType<typeof respondWith>) {
  const [url, init] = fetchSpy.mock.calls[0] ?? [];
  return { url: String(url), init, body: JSON.parse(String(init?.body)) as unknown };
}

afterEach(() => vi.restoreAllMocks());

describe("setup requests", () => {
  it("send the setup code header when there is a code", async () => {
    const fetchSpy = respondWith(201, { user: {}, permissions: [], enabledPlugins: [] });

    await createFirstAccount({ name: "Daniel", email: "d@gmail.com", password: "x" }, "K7Q-42M");

    expect(sentRequest(fetchSpy).init?.headers).toEqual({
      "content-type": "application/json",
      "x-lintel-setup-code": "K7Q-42M",
    });
  });

  it("send no setup code header on the same computer", async () => {
    const fetchSpy = respondWith(200, { database: { kind: "built-in", chosenBy: "setup" } });

    await chooseDatabase({ kind: "built-in" }, undefined);

    expect(sentRequest(fetchSpy).init?.headers).toEqual({ "content-type": "application/json" });
  });

  it("send the site type and plugins to /setup/site", async () => {
    const fetchSpy = respondWith(200, { siteType: "blog", plugins: ["blog"] });

    await saveSiteSetup("blog", ["blog"], undefined);

    const request = sentRequest(fetchSpy);
    expect(request.url).toMatch(/\/setup\/site$/);
    expect(request.body).toEqual({ siteType: "blog", plugins: ["blog"] });
  });
});
