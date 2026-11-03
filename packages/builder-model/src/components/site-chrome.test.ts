import { describe, expect, it } from "vitest";
import { createEmptyPage, type PageNode } from "../document/page-document.schema.js";
import { ownSiteChrome, pageEdgeFor } from "./site-navigation-components.js";

function section(id: string, element: string, hidden = false): PageNode {
  return {
    id,
    type: "section",
    name: "",
    props: { element },
    styles: { base: {} },
    children: [],
    hidden,
    locked: false,
  };
}

function pageWith(...children: PageNode[]): PageNode {
  return { ...createEmptyPage().root, children };
}

describe("a page's own header and footer", () => {
  it("counts a section drawn as the page's header, as it does a footer section", () => {
    expect(ownSiteChrome(pageWith(section("nav", "header"), section("body", "section")))).toEqual({
      header: true,
      footer: false,
    });
    expect(ownSiteChrome(pageWith(section("body", "section"), section("end", "footer")))).toEqual({
      header: false,
      footer: true,
    });
  });

  it("ignores hidden ones and plain sections", () => {
    expect(
      ownSiteChrome(pageWith(section("nav", "header", true), section("body", "section"))),
    ).toEqual({ header: false, footer: false });
  });

  it("puts a header section at the top of the page when it's added", () => {
    expect(pageEdgeFor({ type: "section", props: { element: "header" } })).toBe("top");
    expect(pageEdgeFor({ type: "section", props: { element: "footer" } })).toBe("bottom");
    expect(pageEdgeFor({ type: "section", props: { element: "section" } })).toBeNull();
  });
});
