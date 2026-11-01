import { afterEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));

const { POST } = await import("./route");

function request(query = "", secret?: string): Request {
  return new Request(`http://localhost:3000/api/revalidate${query}`, {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

afterEach(() => {
  revalidateTag.mockReset();
  vi.unstubAllEnvs();
});

describe("POST /api/revalidate", () => {
  it("is switched off until a secret is set", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");

    expect((await POST(request("", "anything"))).status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "correct horse battery staple");

    expect((await POST(request("", "wrong"))).status).toBe(401);
    expect((await POST(request(""))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refreshes one collection, or everything from Lintel", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "s3cret");

    const one = await POST(request("?collection=posts", "s3cret"));
    const all = await POST(request("", "s3cret"));

    expect(await one.json()).toEqual({ revalidated: "lintel:posts" });
    expect(await all.json()).toEqual({ revalidated: "lintel" });
    expect(revalidateTag).toHaveBeenNthCalledWith(1, "lintel:posts", "max");
    expect(revalidateTag).toHaveBeenNthCalledWith(2, "lintel", "max");
  });
});
