import { describe, expect, it } from "vitest";
import { postsCollection } from "../content/testEntries.js";
import { matchesWords, matchingPages, resultItems } from "./paletteItems.js";

describe("command palette items", () => {
  it("matches when every word starts a word of the text", () => {
    expect(matchesWords("Content types", "con ty")).toBe(true);
    expect(matchesWords("Content types", "types")).toBe(true);
    expect(matchesWords("Content types", "ntent")).toBe(false);
    expect(matchesWords("Content types", "  ")).toBe(false);
  });

  it("only lists pages the person may open", () => {
    const everything = matchingPages("se", {
      permissions: ["*"],
      enabledPlugins: [],
      collections: [],
    });
    expect(everything.map((item) => item.label)).toContain("Settings");

    const editor = matchingPages("se", {
      permissions: ["entries:read"],
      enabledPlugins: [],
      collections: [],
    });
    expect(editor.map((item) => item.label)).not.toContain("Settings");
  });

  it("lists collections and settings screens that aren't in the sidebar", () => {
    const context = { permissions: ["*"], enabledPlugins: [], collections: [postsCollection] };
    expect(matchingPages("types", context).map((item) => item.target)).toEqual([
      { kind: "page", path: "/settings/content-types" },
    ]);
    expect(matchingPages("blog", context).map((item) => item.target)).toEqual([
      { kind: "collection", collectionHandle: "posts" },
    ]);
  });

  it("turns the API's results into rows, entries first", () => {
    const items = resultItems({
      query: "hello",
      entries: [
        {
          id: "p1",
          title: "Hello world",
          slug: "hello-world",
          status: "draft",
          collection: { handle: "posts", name: "Blog posts" },
          updatedAt: "2026-10-01T09:00:00Z",
        },
      ],
      assets: [
        {
          id: "a1",
          filename: "hello.png",
          alt: "A wave",
          mimeType: "image/png",
          thumbnailUrl: "x",
        },
      ],
    });
    expect(items.map((item) => [item.group, item.label, item.detail])).toEqual([
      ["entries", "Hello world", "Blog posts · Draft"],
      ["media", "hello.png", "A wave"],
    ]);
    expect(resultItems({ query: "x", entries: null, assets: null })).toEqual([]);
  });
});
