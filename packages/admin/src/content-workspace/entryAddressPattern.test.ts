import { describe, expect, it } from "vitest";
import { entryAddressPattern } from "./entryAddressPattern.js";

describe("the address under a page's title", () => {
  it("follows the page's place under the pages at the top", () => {
    const under = { url: "/shop/boots", siteStart: null };
    expect(entryAddressPattern("/{slug}", "boots", under)).toEqual({ pattern: "/shop/{slug}" });
    const onDomain = { url: "https://shop.example.com/boots", siteStart: null };
    expect(entryAddressPattern("/{slug}", "boots", onDomain)).toEqual({
      pattern: "https://shop.example.com/{slug}",
    });
  });

  it("shows the home page's address as it is, without its slug", () => {
    const home = { url: "/", siteStart: { isDefault: true } };
    expect(entryAddressPattern("/{slug}", "home", home)).toEqual({
      pattern: "/{slug}",
      fixedAddress: "/",
    });
  });

  it("keeps the collection's pattern before anything is known", () => {
    expect(entryAddressPattern("/blog/{slug}", "hello", undefined)).toEqual({
      pattern: "/blog/{slug}",
    });
  });
});
