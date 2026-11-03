import { createEmptyPage, type PageDocument, type PageNode } from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { checkPageDesign, readPageDesign } from "./designed-pages.js";

function element(id: string, type: string, props: Record<string, unknown> = {}): PageNode {
  return {
    id,
    type,
    name: "",
    props,
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
  };
}

function designWith(...children: PageNode[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children } };
}

describe("designed pages on the website", () => {
  // LINTEL-FUNC-023: one element that no longer checked out hid the whole designed page.
  it("leaves out an element this version doesn't know, and draws the rest", () => {
    const section = {
      ...element("intro", "section"),
      children: [element("title", "heading", { text: "Fresh bread daily" })],
    };
    const design = designWith(section, element("old", "retired-widget"));

    const checked = checkPageDesign(design);

    expect(checked?.root.children.map((child) => child.id)).toEqual(["intro"]);
    expect(readPageDesign(design)?.html).toContain("Fresh bread daily");
  });

  it("leaves out an element whose content no longer fits, with what's inside it", () => {
    const broken = {
      ...element("hero", "section"),
      children: [element("bad", "heading", { level: "seventeen" })],
    };
    const design = designWith(broken, element("kept", "heading", { text: "Opening hours" }));

    expect(checkPageDesign(design)?.root.children.map((child) => child.id)).toEqual([
      "hero",
      "kept",
    ]);
    expect(checkPageDesign(design)?.root.children[0]?.children).toEqual([]);
  });

  it("still counts a design it can't read at all as no design", () => {
    expect(checkPageDesign({ version: 1, root: "not a page" })).toBeNull();
    expect(checkPageDesign(designWith(element("old", "retired-widget")))).toBeNull();
  });
});
