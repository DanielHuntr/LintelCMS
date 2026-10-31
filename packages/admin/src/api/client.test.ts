import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./client.js";

function respondWith(status: number, body?: unknown) {
  const response = new Response(body === undefined ? null : JSON.stringify(body), { status });
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
}

afterEach(() => vi.restoreAllMocks());

describe("apiRequest", () => {
  it("sends the session cookie and JSON body", async () => {
    const fetchSpy = respondWith(200, { ok: true });

    await apiRequest("/auth/sign-in", { method: "POST", body: { email: "a@example.com" } });

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
    });
  });

  it("sends no content type when there is no body", async () => {
    const fetchSpy = respondWith(204);

    await apiRequest("/auth/sign-out", { method: "POST" });

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    expect(init?.headers).toBeUndefined();
  });

  it("turns API failures into an ApiError with the API's message", async () => {
    respondWith(403, {
      statusCode: 403,
      code: "PERMISSION_DENIED",
      error: "Forbidden",
      message: "You don't have permission to do that",
    });

    await expect(apiRequest("/settings")).rejects.toEqual(
      new ApiError(403, "PERMISSION_DENIED", "You don't have permission to do that"),
    );
  });
});
