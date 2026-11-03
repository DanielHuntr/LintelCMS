import { describe, expect, it } from "vitest";
import { FontFileCache } from "./google-fonts-client.js";
import { mapWithConcurrency } from "./google-fonts.service.js";

describe("the font file cache", () => {
  it("keeps files up to a total size, forgetting the oldest first", () => {
    const cache = new FontFileCache(60_000, 10);
    cache.write("a", Buffer.alloc(4));
    cache.write("b", Buffer.alloc(4));
    cache.write("c", Buffer.alloc(4));
    expect(cache.read("a")).toBeUndefined();
    expect(cache.read("b")?.length).toBe(4);
    expect(cache.size).toBe(8);
    // A file bigger than the whole cache isn't kept, and pushes nothing out.
    cache.write("huge", Buffer.alloc(11));
    expect(cache.read("huge")).toBeUndefined();
    expect(cache.size).toBe(8);
    // Writing a key again counts it once.
    cache.write("b", Buffer.alloc(2));
    expect(cache.size).toBe(6);
  });

  it("forgets files after a while", () => {
    let now = 0;
    const cache = new FontFileCache(1000, 100, () => now);
    cache.write("a", Buffer.alloc(4));
    cache.write("gone", null);
    expect(cache.read("gone")).toBeNull();
    now = 1000;
    expect(cache.read("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});

describe("downloading a few files at once", () => {
  it("runs at most the limit at a time, keeping the order and each failure in its place", async () => {
    let running = 0;
    let most = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async (item) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      if (item === 3) throw new Error("dropped");
      return item * 10;
    });
    expect(most).toBe(4);
    expect(results[0]).toBe(10);
    expect(results[2]).toBeInstanceOf(Error);
    expect(results[9]).toBe(100);
  });
});
