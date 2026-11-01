import { describe, expect, it } from "vitest";
import { viewPageTarget } from "./viewPage.js";

const post = {
  id: "p1",
  slug: "hello",
  status: "published",
  publishedAt: "2026-11-02T10:00:00.000Z",
  locale: "en-GB",
};
const site = { siteAddress: "https://brightsidebakery.com", defaultLocale: "en-GB" };

describe("View page", () => {
  it("opens the page on the website, dates in the route pattern included", () => {
    expect(
      viewPageTarget(site, { handle: "posts", routePattern: "/blog/{year}/{month}/{slug}" }, post),
    ).toEqual({ kind: "website", href: "https://brightsidebakery.com/blog/2026/11/hello" });
  });

  it("builds the address the way the website serves it: home at / and languages by code", () => {
    const pages = { handle: "pages", routePattern: "/{slug}" };
    expect(viewPageTarget(site, pages, { ...post, slug: "home" })).toEqual({
      kind: "website",
      href: "https://brightsidebakery.com/",
    });
    expect(viewPageTarget(site, pages, { ...post, slug: "about", locale: "fr-FR" })).toEqual({
      kind: "website",
      href: "https://brightsidebakery.com/fr-FR/about",
    });
  });

  it("falls back to the built-in preview without a website, and offers nothing for drafts", () => {
    const collection = { handle: "posts", routePattern: "/blog/{slug}" };
    const noWebsite = { siteAddress: null, defaultLocale: "en-GB" };
    expect(viewPageTarget(noWebsite, collection, post)).toEqual({
      kind: "builtIn",
      collection: "posts",
      entryId: "p1",
    });
    expect(viewPageTarget(undefined, collection, post)).toBe(undefined);
    expect(viewPageTarget(site, collection, { ...post, status: "draft" })).toBe(undefined);
  });
});
