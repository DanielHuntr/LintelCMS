import { describe, expect, it } from "vitest";
import { isSafeLinkAddress } from "../components/component-props.js";
import {
  collectPageLinkIds,
  pageLinkHref,
  readPageLinkId,
  resolvePageLinks,
} from "./page-links.js";

const about = "0b9d2c1e-5f3a-4c6b-8d7e-1a2b3c4d5e6f";
const gone = "9f8e7d6c-5b4a-4321-8765-0fedcba98765";

describe("links to pages by id", () => {
  it("reads back the page from the stored form and ignores typed addresses", () => {
    expect(pageLinkHref(about)).toBe(`lintel:page/${about}`);
    expect(readPageLinkId(pageLinkHref(about))).toBe(about);
    expect(readPageLinkId("/about")).toBeNull();
    expect(readPageLinkId("https://example.com")).toBeNull();
    expect(readPageLinkId("lintel:page/not-an-id")).toBeNull();
    expect(readPageLinkId(42)).toBeNull();
  });

  it("can be saved as a builder link, while other schemes still can't", () => {
    expect(isSafeLinkAddress(pageLinkHref(about))).toBe(true);
    expect(isSafeLinkAddress("lintel:page/../../etc")).toBe(false);
    expect(isSafeLinkAddress("javascript:alert(1)")).toBe(false);
  });

  it("finds every page linked anywhere in a value", () => {
    const design = {
      root: {
        props: { href: pageLinkHref(about) },
        children: [{ props: { links: [{ label: "Old", href: pageLinkHref(gone) }] } }],
      },
    };
    expect([...collectPageLinkIds(design)].sort()).toEqual([about, gone].sort());
  });

  it("swaps links for the current address, and links to missing pages for no link", () => {
    const value = {
      href: pageLinkHref(about),
      typed: "/contact",
      links: [{ href: pageLinkHref(gone), label: "Old page" }],
    };
    const resolved = resolvePageLinks(value, (entryId) => (entryId === about ? "/about-us" : null));
    expect(resolved).toEqual({
      href: "/about-us",
      typed: "/contact",
      links: [{ href: "", label: "Old page" }],
    });
    // The original is left alone.
    expect(value.href).toBe(pageLinkHref(about));
  });
});
