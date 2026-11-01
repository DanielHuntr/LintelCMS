import { describe, expect, it } from "vitest";
import {
  listPath,
  localisedPath,
  matchSiteRoute,
  type RoutedCollection,
  splitLocale,
  tidyPath,
} from "./site-routing.js";

const collections: RoutedCollection[] = [
  {
    handle: "pages",
    name: "Pages",
    structure: "tree",
    routePattern: "/{slug}",
    taxonomyHandles: [],
  },
  {
    handle: "posts",
    name: "Blog",
    structure: "dated",
    routePattern: "/blog/{slug}",
    taxonomyHandles: ["categories", "tags"],
  },
  {
    handle: "news",
    name: "News",
    structure: "dated",
    routePattern: "/news/{year}/{slug}",
    taxonomyHandles: [],
  },
];

describe("routing an address on the website", () => {
  it("finds pages, posts and posts with dates in their address", () => {
    expect(matchSiteRoute("/", collections)).toEqual([{ kind: "home" }]);
    expect(matchSiteRoute("/about", collections)).toEqual([
      { kind: "entry", collection: "pages", slug: "about" },
    ]);
    expect(matchSiteRoute("/blog/sourdough", collections)).toEqual([
      { kind: "entry", collection: "posts", slug: "sourdough" },
    ]);
    expect(matchSiteRoute("/news/2026/opening", collections)).toEqual([
      { kind: "entry", collection: "news", slug: "opening" },
    ]);
  });

  it("finds a blog's list, its pages and its archives before a page of the same name", () => {
    expect(matchSiteRoute("/blog", collections)).toEqual([
      { kind: "list", collection: "posts", page: 1 },
      { kind: "entry", collection: "pages", slug: "blog" },
    ]);
    expect(matchSiteRoute("/blog/page/3", collections)[0]).toEqual({
      kind: "list",
      collection: "posts",
      page: 3,
    });
    expect(matchSiteRoute("/blog/tags/bread/page/2", collections)).toEqual([
      { kind: "archive", collection: "posts", taxonomy: "tags", term: "bread", page: 2 },
    ]);
    // Page 1 has no address of its own, and unknown taxonomies aren't archives.
    expect(matchSiteRoute("/blog/page/1", collections)).toEqual([]);
    expect(matchSiteRoute("/blog/colours/red", collections)).toEqual([]);
  });

  it("reads a language prefix, for the site's other languages only", () => {
    const locales = ["en-GB", "fr-FR"];
    expect(splitLocale("/fr-fr/about", "en-GB", locales)).toEqual({
      locale: "fr-FR",
      path: "/about",
    });
    expect(splitLocale("/fr-FR", "en-GB", locales)).toEqual({ locale: "fr-FR", path: "/" });
    expect(splitLocale("/en-GB/about", "en-GB", locales)).toEqual({
      locale: "en-GB",
      path: "/en-GB/about",
    });
    expect(localisedPath("/", "fr-FR", "en-GB")).toBe("/fr-FR");
    expect(localisedPath("/about", "en-GB", "en-GB")).toBe("/about");
  });

  it("tidies addresses and refuses ones it can't read", () => {
    expect(tidyPath("/about/")).toBe("/about");
    expect(tidyPath("//blog//hello")).toBe("/blog/hello");
    expect(tidyPath("/caf%C3%A9")).toBe("/café");
    expect(tidyPath("/%E0%A4%A")).toBeNull();
    expect(listPath("/blog", 1)).toBe("/blog");
    expect(listPath("/blog", 2)).toBe("/blog/page/2");
  });
});
