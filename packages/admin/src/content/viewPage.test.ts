import { describe, expect, it } from "vitest";
import { publishedPath, viewPageTarget } from "./viewPage.js";

const post = {
  id: "p1",
  slug: "hello",
  status: "published",
  publishedAt: "2026-11-02T10:00:00.000Z",
};

describe("View page", () => {
  it("fills in the route pattern, dates included", () => {
    expect(publishedPath("/blog/{year}/{month}/{slug}", post)).toBe("/blog/2026/11/hello");
  });

  it("opens the page on the connected website", () => {
    expect(
      viewPageTarget(
        "https://brightsidebakery.com",
        { handle: "posts", routePattern: "/blog/{slug}" },
        post,
      ),
    ).toEqual({ kind: "website", href: "https://brightsidebakery.com/blog/hello" });
  });

  it("falls back to the built-in preview without a website, and offers nothing for drafts", () => {
    const collection = { handle: "posts", routePattern: "/blog/{slug}" };
    expect(viewPageTarget("", collection, post)).toEqual({
      kind: "builtIn",
      collection: "posts",
      entryId: "p1",
    });
    expect(viewPageTarget("https://example.com", collection, { ...post, status: "draft" })).toBe(
      undefined,
    );
  });
});
