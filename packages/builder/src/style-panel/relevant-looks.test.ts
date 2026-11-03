import { createCountingNodeIds, createNode, standardCatalogue } from "@lintel/builder-model";
import type { PageNode } from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { relevantLooks } from "./relevant-looks.js";

const createId = createCountingNodeIds("l");
const make = (type: string, children: PageNode[] = []): PageNode => ({
  ...createNode({ type }, standardCatalogue, createId),
  children,
});

describe("which looks make sense for an element", () => {
  it("offers neither Open nor Current for a plain heading", () => {
    const heading = make("heading");
    expect(relevantLooks([make("section", [heading]), heading])).toEqual({
      open: false,
      selected: false,
    });
  });

  it("offers Open for a card with a button in it, and for what's inside an accordion", () => {
    const card = make("card", [make("container", [make("button")])]);
    expect(relevantLooks([card]).open).toBe(true);
    const text = make("text");
    expect(relevantLooks([make("accordionItem", [text]), text]).open).toBe(true);
  });

  it("offers Current for links and for what's inside a menu", () => {
    expect(relevantLooks([make("link")]).selected).toBe(true);
    const text = make("text");
    expect(relevantLooks([make("navigation", [text]), text]).selected).toBe(true);
  });

  it("keeps a look the element already uses", () => {
    const plain = make("box");
    const box = { ...plain, styles: { ...plain.styles, open: { opacity: "1" } } };
    expect(relevantLooks([box]).open).toBe(true);
  });
});
