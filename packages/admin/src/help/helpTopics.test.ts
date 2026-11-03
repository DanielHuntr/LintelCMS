import { findHelpPage, helpPages } from "@lintel/docs/help";
import { describe, expect, it } from "vitest";
import { allHelpTopicSlugs, helpSlugForPath } from "./helpTopics.js";

describe("helpSlugForPath", () => {
  it.each([
    ["/", "using/getting-around"],
    ["/content", "using/content-tree"],
    ["/content/pages", "using/content-tree"],
    ["/content/pages/0b9a9f8e-5d4c-4b3a-9e2d-1c0b9a8f7e6d", "using/writing"],
    ["/content/posts", "using/writing"],
    ["/content/posts/0b9a9f8e-5d4c-4b3a-9e2d-1c0b9a8f7e6d", "using/writing"],
    ["/media", "using/media"],
    ["/settings", "using/content-types"],
    ["/build/content-types/page", "using/content-types"],
    ["/users", "using/users"],
    ["/media/", "using/media"],
  ])("opens the right page on %s", (path, slug) => {
    expect(helpSlugForPath(path)).toBe(slug);
  });

  it("opens the help index on screens without a page of their own", () => {
    expect(helpSlugForPath("/design")).toBe("using");
    expect(helpSlugForPath("/mediaroom")).toBe("using");
  });

  it("only points at pages that are bundled with the admin", () => {
    for (const slug of allHelpTopicSlugs()) {
      expect(findHelpPage(slug), slug).toBeDefined();
    }
  });
});

describe("the bundled help pages", () => {
  it("are the Using Lintel docs, in the docs' order, with their Markdown", () => {
    expect(helpPages[0]?.slug).toBe("using");
    expect(helpPages.map((page) => page.slug)).toContain("using/media");
    expect(helpPages.every((page) => page.slug.startsWith("using"))).toBe(true);
    expect(findHelpPage("using/media")?.markdown).toContain("## Uploading");
  });
});
