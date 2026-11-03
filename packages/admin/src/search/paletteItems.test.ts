import { describe, expect, it } from "vitest";
import { postsCollection } from "../content/testEntries.js";
import { inPaletteOrder, matchingActions } from "./paletteActions.js";
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
      { kind: "page", path: "/build/content-types" },
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

  const light = { choice: "device" as const, current: "light" as const };
  const labels = (items: { label: string }[]) => items.map((item) => item.label);

  it("offers actions only to people who may do them", () => {
    const everything = {
      permissions: ["*"],
      enabledPlugins: [],
      collections: [postsCollection],
      colorScheme: light,
    };
    expect(labels(matchingActions("new", everything))).toEqual(["New entry in Blog posts"]);
    expect(labels(matchingActions("upload", everything))).toEqual(["Upload media"]);
    expect(labels(matchingActions("open", everything))).toEqual(["Open Settings", "Open Build"]);
    expect(labels(matchingActions("invite", everything))).toEqual(["Invite someone"]);

    const viewer = { ...everything, permissions: ["entries:read", "media:read"] };
    expect(matchingActions("new", viewer)).toEqual([]);
    expect(matchingActions("upload", viewer)).toEqual([]);
    expect(matchingActions("open", viewer)).toEqual([]);
    expect(matchingActions("invite", viewer)).toEqual([]);
    expect(labels(matchingActions("sign", viewer))).toEqual(["Sign out"]);
  });

  it("calls the pages collection's action New page, and matches other words for it", () => {
    const context = {
      permissions: ["entries:create"],
      enabledPlugins: [],
      collections: [postsCollection, { ...postsCollection, handle: "pages", name: "Pages" }],
      colorScheme: light,
    };
    expect(labels(matchingActions("new", context))).toEqual([
      "New page",
      "New entry in Blog posts",
    ]);
    expect(labels(matchingActions("create page", context))).toEqual(["New page"]);
    expect(matchingActions("new page", context)[0]?.target).toEqual({
      kind: "action",
      action: { kind: "newEntry", collectionHandle: "pages" },
    });
  });

  it("offers the other scheme, and the device's once one was chosen", () => {
    const context = { permissions: [], enabledPlugins: [], collections: [] };
    expect(labels(matchingActions("mode", { ...context, colorScheme: light }))).toEqual([
      "Switch to dark mode",
    ]);
    const dark = { choice: "dark" as const, current: "dark" as const };
    expect(labels(matchingActions("mode", { ...context, colorScheme: dark }))).toEqual([
      "Switch to light mode",
    ]);
    expect(labels(matchingActions("appearance", { ...context, colorScheme: dark }))).toEqual([
      "Switch to light mode",
      "Match my device’s light or dark setting",
    ]);
  });

  it("lists places, then actions, then results, without a place an action already goes to", () => {
    const context = { permissions: ["*"], enabledPlugins: [], collections: [] };
    const actions = matchingActions("settings", { ...context, colorScheme: light });
    const pages = matchingPages("settings", context);
    expect(labels(pages)).toContain("Settings");

    const items = inPaletteOrder(pages, actions, []);

    expect(labels(items)).toContain("Open Settings");
    expect(labels(items)).not.toContain("Settings");
  });
});
