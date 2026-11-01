import { describe, expect, it } from "vitest";

describe("on the server", () => {
  it("imports without a window and mounts as a no-op", async () => {
    expect(typeof window).toBe("undefined");
    const { mountMotionList } = await import("../index.js");
    const page = mountMotionList([]);
    await expect(page.exitPage()).resolves.toBeUndefined();
    expect(page.controllers).toEqual([]);
  });
});
