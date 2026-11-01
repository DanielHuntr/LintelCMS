import { afterEach, describe, expect, it, vi } from "vitest";
import { finishSetup, testDatabaseConnection } from "./setup.api.js";

function respondWith(status: number, body: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

function sentRequest(fetchSpy: ReturnType<typeof respondWith>) {
  const [url, init] = fetchSpy.mock.calls[0] ?? [];
  return { url: String(url), init, body: JSON.parse(String(init?.body)) as unknown };
}

const answers = {
  database: { kind: "built-in" as const },
  account: { name: "Daniel", email: "d@gmail.com", password: "maple orbit cactus river" },
  site: { siteName: "Brightside", siteType: "blog" as const },
};

afterEach(() => vi.restoreAllMocks());

describe("setup requests", () => {
  it("send every answer to /setup/finish at once, with the setup code when there is one", async () => {
    const fetchSpy = respondWith(201, { user: {}, permissions: [], enabledPlugins: [] });

    await finishSetup(answers, "K7Q-42M");

    const request = sentRequest(fetchSpy);
    expect(request.url).toMatch(/\/setup\/finish$/);
    expect(request.body).toEqual(answers);
    expect(request.init?.headers).toEqual({
      "content-type": "application/json",
      "x-lintel-setup-code": "K7Q-42M",
    });
  });

  it("send no setup code header on the same computer", async () => {
    const fetchSpy = respondWith(200, { ok: true });

    await testDatabaseConnection(
      {
        host: "localhost",
        port: 5432,
        database: "lintel",
        user: "postgres",
        password: "",
        ssl: false,
      },
      undefined,
    );

    expect(sentRequest(fetchSpy).init?.headers).toEqual({ "content-type": "application/json" });
  });
});
